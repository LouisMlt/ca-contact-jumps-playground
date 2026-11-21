"""Generate a bounded numerical CA path from prime-power thresholds.

Integers and factorisations are exact. Logarithms and event ordering use double
precision; this is illustrative data, not a formal certificate. The candidate
bounds below are checked beyond the last retained event. Potential near-ties
cause generation to fail instead of silently choosing an order.
"""
import argparse
from fractions import Fraction
import json
import math
from pathlib import Path

PRIME_BOUND = 2000
MAX_EXPONENT = 40
EVENT_COUNT = 180
OUTPUT = Path(__file__).resolve().parents[1] / 'src' / 'data' / 'ca-states.json'


def primes_up_to(bound):
    return [n for n in range(2, bound + 1)
            if all(n % d for d in range(2, math.isqrt(n) + 1))]


def threshold(p, a):
    total = sum(p ** i for i in range(1, a + 1))
    return math.log1p(1 / total) / math.log(p)


def generate():
    primes = primes_up_to(PRIME_BOUND)
    events = sorted(((threshold(p, a), p, a) for p in primes
                     for a in range(1, MAX_EXPONENT + 1)), reverse=True)
    retained = events[:EVENT_COUNT + 1]
    cutoff = retained[-1][0]
    # F(p,a) decreases with p and a. Bound all omitted primes/exponents.
    assert threshold(PRIME_BOUND + 1, 1) < cutoff
    assert threshold(2, MAX_EXPONENT + 1) < cutoff
    assert all(abs(x[0] - y[0]) > 1e-12 * max(x[0], y[0])
               for x, y in zip(retained, retained[1:])), 'Unresolved numerical event tie'
    n, factors, states = 1, {}, []

    def record(upper, lower, entering):
        rho = Fraction(1)
        for p, a in factors.items():
            rho *= Fraction(p ** (a + 1) - 1, (p - 1) * p ** a)
        states.append({
            'n': str(n), 'logN': math.log(n),
            'logRho': math.log(rho.numerator) - math.log(rho.denominator),
            'rho': float(rho), 'factors': [[p, a] for p, a in sorted(factors.items())],
            'epsilonUpper': upper, 'epsilonLower': lower, 'entering': entering,
        })

    record(None, events[0][0], None)
    for i, (epsilon, p, a) in enumerate(events[:EVENT_COUNT]):
        assert a == factors.get(p, 0) + 1
        n *= p
        factors[p] = a
        record(epsilon, events[i + 1][0], [p, a])
    assert [s['n'] for s in states[:11]] == [
        '1', '2', '6', '12', '60', '120', '360', '2520', '5040', '55440', '720720']
    return {
        'description': 'Bounded numerical CA path; exact integers, floating-point thresholds. No global contact certification.',
        'generator': {'primeBound': PRIME_BOUND, 'maxExponent': MAX_EXPONENT, 'eventCount': EVENT_COUNT},
        'reference': '55440', 'states': states,
    }


def serialize(data):
    # Keep the complete sample in the checkout for build-free branch previews,
    # without tens of thousands of indentation-only lines in code reviews.
    lines = ['{', '  "description": ' + json.dumps(data['description']) + ',',
             '  "generator": ' + json.dumps(data['generator'], separators=(',', ':')) + ',',
             '  "reference": ' + json.dumps(data['reference']) + ',', '  "states": [']
    lines.append(',\n'.join('    ' + json.dumps(s, ensure_ascii=False, separators=(',', ':'))
                           for s in data['states']))
    lines.extend(['  ]', '}', ''])
    return '\n'.join(lines)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    expected = serialize(generate())
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != expected:
            raise SystemExit('Data differs: run python3 scripts/generate_data.py')
        print('Numerical CA data regenerates identically; event bounds and ordering checked.')
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(expected)
        print(f'Wrote {OUTPUT}')
