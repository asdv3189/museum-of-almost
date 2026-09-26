import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { MuseumError } from '../src/domain/model';
import { SanityMuseumRepository } from '../src/repositories/sanity';
import { authorizeWorkbench } from '../src/server/access';

const CURATOR_KEY = 'offline-curator-test-key-32-characters-minimum';

function withEnvironment<T>(values: Record<string, string | undefined>, operation: () => T): T {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { return operation(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function request({
  url = 'http://localhost:8792/api/workbench',
  method = 'POST',
  host = '127.0.0.1:8792',
  origin = 'http://127.0.0.1:8792',
  authorization,
  extraHeaders = {},
}: {
  url?: string;
  method?: string;
  host?: string | null;
  origin?: string | null;
  authorization?: string;
  extraHeaders?: Record<string, string>;
} = {}): Request {
  const headers = new Headers(extraHeaders);
  if (host !== null) headers.set('host', host);
  if (origin !== null) headers.set('origin', origin);
  if (authorization !== undefined) headers.set('authorization', authorization);
  return new Request(url, { method, headers });
}

function rejectsAccess(operation: () => unknown, code: string | null, status = 403) {
  assert.throws(operation, (error: unknown) => {
    assert.ok(error instanceof MuseumError, 'Access failures must be controlled errors, including malformed input');
    assert.equal(error.status, status);
    if (code !== null) assert.equal(error.code, code);
    return true;
  });
}

test('local mutations accept Host and Origin 127.0.0.1 when Next has normalized the request URL to localhost', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    const normalized = request();
    assert.equal(new URL(normalized.url).hostname, 'localhost');
    assert.doesNotThrow(() => authorizeWorkbench(normalized));
  });
});

test('the public NextRequest API preserves valid loopback mutation authorization', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    const nextRequest = new NextRequest('http://127.0.0.1:8792/api/workbench', {
      method: 'POST',
      headers: { host: '127.0.0.1:8792', origin: 'http://127.0.0.1:8792' },
    });
    assert.doesNotThrow(() => authorizeWorkbench(nextRequest));
  });
});

test('Origin localhost cannot substitute for the actual Host authority 127.0.0.1', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    rejectsAccess(() => authorizeWorkbench(request({ origin: 'http://localhost:8792' })), 'ORIGIN_REJECTED');
  });
});

test('legitimate localhost Host and Origin authorize local mutations', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    assert.doesNotThrow(() => authorizeWorkbench(request({ host: 'localhost:8792', origin: 'http://localhost:8792' })));
  });
});

test('all mutation methods require an Origin header', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      rejectsAccess(() => authorizeWorkbench(request({ method, origin: null })), 'ORIGIN_REJECTED');
    }
  });
});

test('a local GET may omit Origin while still satisfying both loopback checks', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    assert.doesNotThrow(() => authorizeWorkbench(request({ method: 'GET', origin: null })));
  });
});

test('missing storage configuration keeps the loopback-only default', () => {
  withEnvironment({ MUSEUM_STORAGE: undefined }, () => {
    assert.doesNotThrow(() => authorizeWorkbench(request({ method: 'GET', origin: null })));
    rejectsAccess(() => authorizeWorkbench(request({
      method: 'GET', origin: null, url: 'https://museum.example/api/workbench', host: 'museum.example',
    })), 'LOCAL_ONLY');
  });
});

test('local mode rejects an external Host even if the request URL was normalized to loopback', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    rejectsAccess(() => authorizeWorkbench(request({ host: 'museum.example:8792', origin: 'http://museum.example:8792' })), 'LOCAL_ONLY');
  });
});

test('local mode rejects an external URL even when Host and Origin claim loopback', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    rejectsAccess(() => authorizeWorkbench(request({ url: 'http://museum.example:8792/api/workbench' })), 'LOCAL_ONLY');
  });
});

test('local GET requests with a missing Host or external authority are rejected', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    for (const host of [null, 'museum.example:8792']) {
      rejectsAccess(() => authorizeWorkbench(request({ method: 'GET', origin: null, host })), null);
    }
  });
});

test('the same host name on another port or protocol is still a different origin', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    for (const origin of ['http://127.0.0.1:8793', 'https://127.0.0.1:8792', 'null']) {
      rejectsAccess(() => authorizeWorkbench(request({ origin })), 'ORIGIN_REJECTED');
    }
  });
});

test('forwarded host headers cannot replace the actual Host authority for origin checks', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    rejectsAccess(() => authorizeWorkbench(request({
      origin: 'http://museum.example:8792',
      extraHeaders: { 'x-forwarded-host': 'museum.example:8792', 'x-forwarded-proto': 'http' },
    })), 'ORIGIN_REJECTED');
    assert.doesNotThrow(() => authorizeWorkbench(request({ extraHeaders: { 'x-forwarded-host': 'museum.example:8792' } })));
  });
});

test('bracketed IPv6 loopback works with its matching Host and Origin', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    assert.doesNotThrow(() => authorizeWorkbench(request({
      url: 'http://[::1]:8792/api/workbench', host: '[::1]:8792', origin: 'http://[::1]:8792',
    })));
  });
});

test('a default port in Host uses the browser-normalized origin', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    assert.doesNotThrow(() => authorizeWorkbench(request({
      url: 'http://localhost/api/workbench', host: 'localhost:80', origin: 'http://localhost',
    })));
  });
});

test('malformed Host authorities fail with controlled errors instead of bypassing the guard', () => {
  withEnvironment({ MUSEUM_STORAGE: 'local' }, () => {
    for (const host of ['localhost:8792@museum.example', 'localhost:8792, museum.example', 'localhost:8792/path', '[::1', 'localhost:99999']) {
      rejectsAccess(() => authorizeWorkbench(request({ host, method: 'GET', origin: null })), null);
    }
  });
});

test('cloud access accepts a correctly configured curator key on the same origin', () => {
  withEnvironment({ MUSEUM_STORAGE: 'sanity', MUSEUM_CURATOR_KEY: CURATOR_KEY }, () => {
    assert.doesNotThrow(() => authorizeWorkbench(request({
      url: 'https://museum.example/api/workbench', host: 'museum.example', origin: 'https://museum.example',
      authorization: `Bearer ${CURATOR_KEY}`,
    })));
  });
});

test('cloud access rejects missing, incorrect, and non-Bearer curator credentials', () => {
  withEnvironment({ MUSEUM_STORAGE: 'sanity', MUSEUM_CURATOR_KEY: CURATOR_KEY }, () => {
    for (const authorization of [undefined, 'Bearer wrong', `Bearer ${'x'.repeat(CURATOR_KEY.length)}`, `Basic ${CURATOR_KEY}`]) {
      rejectsAccess(() => authorizeWorkbench(request({
        url: 'https://museum.example/api/workbench', host: 'museum.example', origin: 'https://museum.example', authorization,
      })), 'CURATOR_AUTH_REQUIRED', 401);
    }
  });
});

test('cloud access requires a configured server key of at least 32 characters', () => {
  for (const key of [undefined, '', 'x'.repeat(31)]) {
    withEnvironment({ MUSEUM_STORAGE: 'sanity', MUSEUM_CURATOR_KEY: key }, () => {
      rejectsAccess(() => authorizeWorkbench(request({
        url: 'https://museum.example/api/workbench', host: 'museum.example', origin: 'https://museum.example',
        authorization: `Bearer ${key ?? ''}`,
      })), 'CURATOR_AUTH_REQUIRED', 401);
    });
  }
  withEnvironment({ MUSEUM_STORAGE: 'sanity', MUSEUM_CURATOR_KEY: 'x'.repeat(32) }, () => {
    assert.doesNotThrow(() => authorizeWorkbench(request({
      url: 'https://museum.example/api/workbench', host: 'museum.example', origin: 'https://museum.example',
      authorization: `Bearer ${'x'.repeat(32)}`,
    })));
  });
});

test('a Unicode credential with equal character count but different byte length is denied without throwing a crypto RangeError', () => {
  withEnvironment({ MUSEUM_STORAGE: 'sanity', MUSEUM_CURATOR_KEY: 'x'.repeat(32) }, () => {
    const wrong = 'é'.repeat(32);
    assert.equal(wrong.length, 32);
    assert.notEqual(Buffer.byteLength(wrong), 32);
    rejectsAccess(() => authorizeWorkbench(request({
      url: 'https://museum.example/api/workbench', host: 'museum.example', origin: 'https://museum.example',
      authorization: `Bearer ${wrong}`,
    })), 'CURATOR_AUTH_REQUIRED', 401);
  });
});

test('a correct cloud curator key cannot override cross-origin or missing-origin rejection', () => {
  withEnvironment({ MUSEUM_STORAGE: 'sanity', MUSEUM_CURATOR_KEY: CURATOR_KEY }, () => {
    for (const origin of ['https://attacker.example', 'http://museum.example', null]) {
      rejectsAccess(() => authorizeWorkbench(request({
        url: 'https://museum.example/api/workbench', host: 'museum.example', origin,
        authorization: `Bearer ${CURATOR_KEY}`,
      })), 'ORIGIN_REJECTED');
    }
  });
});

test('cloud GET can omit Origin but still requires the curator key', () => {
  withEnvironment({ MUSEUM_STORAGE: 'sanity', MUSEUM_CURATOR_KEY: CURATOR_KEY }, () => {
    const base = { url: 'https://museum.example/api/workbench', host: 'museum.example', method: 'GET', origin: null };
    rejectsAccess(() => authorizeWorkbench(request(base)), 'CURATOR_AUTH_REQUIRED', 401);
    assert.doesNotThrow(() => authorizeWorkbench(request({ ...base, authorization: `Bearer ${CURATOR_KEY}` })));
  });
});

test('Sanity repository rejects missing read credentials before configuring a client', () => {
  for (const token of [undefined, '']) {
    withEnvironment({ SANITY_READ_TOKEN: token, SANITY_PROJECT_ID: undefined, SANITY_DATASET: undefined }, () => {
      rejectsAccess(() => new SanityMuseumRepository(), 'SANITY_READ_TOKEN_REQUIRED', 503);
    });
  }
});

test('Sanity read-token preflight still requires valid project and dataset configuration', () => {
  withEnvironment({ SANITY_READ_TOKEN: 'offline-read-token', SANITY_PROJECT_ID: undefined, SANITY_DATASET: undefined }, () => {
    rejectsAccess(() => new SanityMuseumRepository(), 'SANITY_NOT_CONFIGURED', 503);
  });
});
