"""Real Chromium checks, including serving under a repository subpath.

Run in CI or a normal local development environment after `npm run build`.
No browser control is attempted in managed environments lacking its QA tool.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from fractions import Fraction
import math
import os
import shutil as browser_paths
import shutil
import tempfile
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class PlaygroundTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        shutil.copytree(ROOT / 'dist', Path(cls.directory.name) / 'ca-contact-jumps-playground')
        shutil.copytree(ROOT / 'src', Path(cls.directory.name) / 'source-branch')
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=cls.directory.name))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/ca-contact-jumps-playground/'
        cls.playwright = sync_playwright().start()
        executable = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH')
        if not executable and not Path(cls.playwright.chromium.executable_path).exists():
            executable = browser_paths.which('chromium') or browser_paths.which('chromium-browser')
        cls.browser = cls.playwright.chromium.launch(executable_path=executable)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.directory.cleanup()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1440, 'height': 1000})
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(self.url)
        self.page.locator('#plot [data-point]').first.wait_for()

    def tearDown(self):
        Path('test-results').mkdir(exist_ok=True)
        self.page.screenshot(path=f'test-results/{self.id().split(".")[-1]}.png', full_page=True)
        self.page.close()
        self.assertEqual(self.errors, [], 'Browser JavaScript errors')

    def test_visual_layouts(self):
        Path('test-results').mkdir(exist_ok=True)
        self.page.screenshot(path='test-results/desktop.png', full_page=True)
        self.page.set_viewport_size({'width': 375, 'height': 950})
        self.page.screenshot(path='test-results/mobile.png', full_page=True)

    def set_range(self, selector, value):
        self.page.locator(selector).evaluate('''(element, value) => {
            element.value = value;
            element.dispatchEvent(new Event('input', {bubbles: true}));
        }''', str(value))

    def test_schematic_plot_has_multiple_supports_and_visible_skipped_points(self):
        self.page.locator('[data-mode="schematic"]').click()
        self.assertIn('SCHEMATIC', self.page.locator('#plot-kind').inner_text())
        self.assertEqual(self.page.locator('#plot [data-point]').count(), 9)
        self.assertEqual(self.page.locator('#plot path[stroke-dasharray="7 6"]').count(), 3)
        self.page.locator('#plot [data-point="s1"]').press('Enter')
        self.assertIn('A skipped point', self.page.locator('#inspector').inner_text())
        self.assertIn('Gap to the finite upper boundary', self.page.locator('#inspector').inner_text())
        selected = self.page.locator('#plot [data-point="s1"]')
        self.assertEqual(selected.get_attribute('aria-pressed'), 'true')
        self.assertGreater(float(selected.locator('.selection-halo').get_attribute('opacity')), 0)
        self.assertTrue(selected.evaluate('(element) => document.activeElement === element'))
        self.page.locator('#plot [data-point="s3"]').click()
        self.assertEqual(selected.get_attribute('aria-pressed'), 'false')
        self.assertEqual(self.page.locator('#plot [data-point="s3"]').get_attribute('aria-pressed'), 'true')

    def test_default_is_real_data_with_independently_computed_coordinates(self):
        self.assertIn('REAL CA DATA', self.page.locator('#plot-kind').inner_text())
        self.assertEqual(self.page.locator('#plot [data-point]').count(), 30)
        point = self.page.locator('#plot [data-point="55440"]')
        n = 55440
        sigma = sum(d + n//d if d*d != n else d for d in range(1, math.isqrt(n)+1) if n % d == 0)
        self.assertAlmostEqual(float(point.get_attribute('data-x')), math.sqrt(math.log(n)), places=12)
        self.assertAlmostEqual(float(point.get_attribute('data-y')), float(Fraction(sigma, n)), places=10)
        point.press('Enter')
        self.assertIn('Original X', self.page.locator('#inspector').inner_text())
        self.assertIn('Original Y', self.page.locator('#inspector').inner_text())

    def test_gap_view_exposes_actual_negative_gaps(self):
        self.page.locator('[data-view="gaps"]').click()
        self.assertEqual(self.page.locator('#plot').get_attribute('data-projection'), 'gaps')
        self.assertIn('diagnostic projection', self.page.locator('#scope-note').inner_text().lower())
        self.assertTrue(self.page.locator('#slope').is_disabled())
        points = self.page.locator('#plot [data-point]')
        ys = points.evaluate_all('(points) => points.map(p => Number(p.dataset.displayY))')
        self.assertTrue(any(y < 0 for y in ys))
        self.assertTrue(all(y <= 1e-12 for y in ys))
        zeroes = self.page.locator('#plot [data-boundary="true"]').evaluate_all('(points) => points.map(p => Number(p.dataset.displayY))')
        self.assertTrue(all(y == 0 for y in zeroes))
        skipped = self.page.locator('#plot [data-boundary="false"]').first
        self.assertGreater(float(skipped.get_attribute('data-y')), 0)
        self.assertLess(float(skipped.get_attribute('data-display-y')), 0)
        skipped.press('Enter')
        self.assertIn('Gap to the finite upper boundary', self.page.locator('#inspector').inner_text())

    def test_zoom_preserves_full_sample_support(self):
        chart = self.page.locator('#plot')
        before = chart.get_attribute('data-support-intercept')
        self.page.locator('#zoom-in').click()
        self.page.locator('#zoom-in').click()
        self.assertLess(self.page.locator('#plot [data-point]').count(), 30)
        self.assertEqual(chart.get_attribute('data-compared-count'), '30')
        self.assertEqual(chart.get_attribute('data-support-intercept'), before)
        self.page.locator('#pan-right').click()
        self.assertEqual(chart.get_attribute('data-support-intercept'), before)
        self.page.locator('#fit-view').click()
        self.assertEqual(self.page.locator('#plot [data-point]').count(), 30)

    def test_zoom_keeps_selected_endpoints_at_rounding_sensitive_alpha(self):
        self.set_range('#alpha', .13)
        for side in ['first', 'last']:
            point = getattr(self.page.locator('#plot [data-point]'), side)
            identifier = point.get_attribute('data-point')
            point.press('Enter')
            self.page.locator('#zoom-in').click()
            self.assertEqual(self.page.locator(f'#plot [data-point="{identifier}"]').count(), 1)
            self.page.locator('#fit-view').click()

    def test_source_branch_runs_directly_without_build_artifacts(self):
        self.page.goto(self.url.replace('/ca-contact-jumps-playground/', '/source-branch/'))
        self.page.locator('#plot [data-point]').first.wait_for()
        self.assertEqual(self.page.locator('#plot [data-point]').count(), 30)
        self.page.locator('[data-view="gaps"]').click()
        self.assertEqual(self.page.locator('#plot').get_attribute('data-projection'), 'gaps')

    def test_data_failure_disables_controls_without_secondary_errors(self):
        self.page.route('**/data/ca-states.json', lambda route: route.fulfill(status=404, body='Not found'))
        self.page.reload()
        self.page.locator('#load-error').wait_for(state='visible')
        for element in self.page.locator('.playground button, .playground input, .playground select').all():
            self.assertTrue(element.is_disabled())
        self.assertTrue(self.page.locator('#plot').is_hidden())
        self.assertTrue(self.page.locator('#argument').is_visible())

    def test_numerical_mode_preserves_finite_scope_and_reference(self):
        self.page.get_by_role('button', name='Real CA sample').click()
        self.assertEqual(self.page.locator('#plot [data-point]').count(), 30)
        self.assertIn('later CA states may invalidate', self.page.locator('#scope-note').inner_text())
        self.page.locator('#plot [data-point="55440"]').press('Enter')
        self.assertIn('excluded', self.page.locator('#inspector').inner_text())
        self.page.locator('#power').select_option('4')
        self.set_range('#alpha', '0.95')
        self.page.locator('#sample-count').select_option('80')
        self.assertEqual(self.page.locator('#plot [data-point]').count(), 80)
        self.assertEqual(self.page.locator('#alpha-value').inner_text(), '0.95')

    def test_classical_ties_and_counterexample(self):
        self.page.locator('[data-scene="switches"]').click()
        self.page.locator('#tie-five').click()
        text = self.page.locator('#inspector').inner_text()
        self.assertIn('BOTH CHOICES', text)
        self.assertIn('12 & 60', text)
        self.page.locator('#tie-two').click()
        self.assertIn('60 & 120', self.page.locator('#inspector').inner_text())
        self.page.locator('#plot [data-point="24"]').press('Enter')
        self.assertIn('24 is not CA', self.page.locator('#inspector').inner_text())

    def test_clean_block_and_reset(self):
        self.page.locator('[data-scene="block"]').click()
        self.assertEqual(self.page.locator('#plot [data-point]').count(), 5)
        self.assertEqual(self.page.locator('#plot [data-point="left"]').count(), 0)
        self.set_range('#prime-count', '8')
        self.assertEqual(self.page.locator('.prime-tokens>.prime-label').count(), 8)
        self.page.locator('[data-step="2"]').click()
        self.assertIn('slope condition', self.page.locator('#inspector').inner_text())
        self.page.locator('[data-step="3"]').click()
        self.assertIn('\\ge 8', self.page.locator('#inspector [data-tex]').first.get_attribute('data-tex'))
        self.assertEqual(self.page.locator('#plot [data-point="left"]').count(), 1)
        self.assertIn('not a computed clean cluster', self.page.locator('#scope-note').inner_text())
        self.page.locator('#reset').click()
        self.assertEqual(self.page.locator('#prime-count').input_value(), '4')

    def test_latex_and_alpha_are_not_swapped(self):
        self.assertGreaterEqual(self.page.locator('#formula .katex').count(), 3)
        self.assertEqual(self.page.locator('.katex-error').count(), 0)
        for alpha in [.1, .95]:
            self.set_range('#alpha', alpha)
            point = self.page.locator('#plot [data-point="55440"]')
            self.assertAlmostEqual(float(point.get_attribute('data-x')), math.exp(alpha * math.log(math.log(55440))), places=11)
        self.page.locator('[data-scene="block"]').click()
        self.assertIn('NOT COMPUTED CA DATA', self.page.locator('#plot-kind').inner_text())

    def test_share_parameters_restore_and_invalid_values_are_rejected(self):
        self.page.goto(self.url + '?scene=contacts&mode=numerical&alpha=0.8&k=3&count=60&turn=500')
        self.page.locator('#plot [data-point]').first.wait_for()
        self.assertEqual(self.page.locator('#plot [data-point]').count(), 60)
        self.assertEqual(self.page.locator('#power').input_value(), '3')
        self.page.goto(self.url + '?alpha=1&k=0&count=NaN&turn=-30')
        self.page.locator('#plot [data-point]').first.wait_for()
        self.assertEqual(self.page.locator('#alpha').input_value(), '0.5')

    def test_plot_download_keeps_scope_description(self):
        with self.page.expect_download() as info:
            self.page.locator('#download').click()
        download = info.value
        svg = Path(download.path()).read_text()
        self.assertIn('First 30 numerical CA states', svg)
        self.assertIn('xmlns="http://www.w3.org/2000/svg"', svg)

    def test_mobile_and_keyboard_and_reduced_motion(self):
        self.page.emulate_media(reduced_motion='reduce')
        for width in [375, 768, 1440]:
            self.page.set_viewport_size({'width': width, 'height': 950})
            self.page.wait_for_function('''() => Math.abs(
                document.querySelector('#plot').viewBox.baseVal.width -
                document.querySelector('#plot').getBoundingClientRect().width) < 2''')
            overflow = self.page.evaluate('''() => [...document.querySelectorAll('body *')]
                .filter(e => e.getBoundingClientRect().right > innerWidth + 1 && e.getBoundingClientRect().width > 0)
                .slice(0, 8).map(e => ({tag: e.tagName, cls: String(e.className), text: e.textContent.slice(0, 80)}))''')
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width + 1, str(overflow))
        self.page.locator('#slope').focus()
        before = float(self.page.locator('#slope').input_value())
        self.page.keyboard.press('ArrowRight')
        self.assertGreater(float(self.page.locator('#slope').input_value()), before)
        self.page.locator('#animate').click()
        self.assertIn('Pause', self.page.locator('#animate').inner_text())
        self.page.locator('#animate').click()
        self.assertIn('Play', self.page.locator('#animate').inner_text())


if __name__ == '__main__':
    unittest.main()
