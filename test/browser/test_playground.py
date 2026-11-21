"""Real Chromium checks, including serving under a repository subpath.

Run in CI or a normal local development environment after `npm run build`.
No browser control is attempted in managed environments lacking its QA tool.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
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
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=cls.directory.name))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/ca-contact-jumps-playground/'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch()

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

    def test_initial_plot_has_multiple_supports_and_visible_skipped_points(self):
        self.assertIn('SCHEMATIC', self.page.locator('#plot-kind').inner_text())
        self.assertEqual(self.page.locator('#plot [data-point]').count(), 9)
        self.assertEqual(self.page.locator('#plot path[stroke-dasharray="7 6"]').count(), 3)
        self.page.locator('#plot [data-point="s1"]').press('Enter')
        self.assertIn('A skipped point', self.page.locator('#inspector').inner_text())
        self.assertIn('Gap to the finite upper boundary', self.page.locator('#inspector').inner_text())

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
        self.set_range('#prime-count', '8')
        self.assertEqual(self.page.locator('.prime-tokens span').count(), 8)
        self.assertIn('≥ 8', self.page.locator('#inspector').inner_text())
        self.assertIn('not a computed clean cluster', self.page.locator('#scope-note').inner_text())
        self.page.locator('#reset').click()
        self.assertEqual(self.page.locator('#prime-count').input_value(), '4')

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
        self.assertIn('Schematic geometry', svg)
        self.assertIn('xmlns="http://www.w3.org/2000/svg"', svg)

    def test_mobile_and_keyboard_and_reduced_motion(self):
        self.page.emulate_media(reduced_motion='reduce')
        for width in [375, 768, 1440]:
            self.page.set_viewport_size({'width': width, 'height': 950})
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width + 1)
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
