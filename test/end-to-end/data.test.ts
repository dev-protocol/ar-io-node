/**
 * AR.IO Gateway
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { strict as assert } from 'node:assert';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { Server } from 'node:http';
import crypto from 'node:crypto';
import { rimraf } from 'rimraf';
import {
  DockerComposeEnvironment,
  GenericContainer,
  StartedDockerComposeEnvironment,
  StartedTestContainer,
  TestContainers,
  Wait,
} from 'testcontainers';
import { createServer } from 'node:http';
import axios from 'axios';

const projectRootPath = process.cwd();

// manifest with invalid/missing index
const tx1 = 'jdcXEvTOkkhSfGTVzHZ4gNZ1nzfK4MrbLKK5IWgOgzY';

// manifest with valid index
const tx2 = 'yecPZWBFO8FnspfrC6y_xChBHYfInssITIip-3OF5kM';

// non-manifest tx
const tx3 = 'lbeIMUvoEqR2q-pKsT4Y5tz6mm9ppemReyLnQ8P7XpM';

// manifest with paths without trailing slash
const tx4 = 'sYaO7sklQ8FyObQNLy7kDbEvwUNKKes7mUnv-_Ri9bE';

describe('Data', function () {
  let compose: StartedDockerComposeEnvironment;

  before(async function () {
    await rimraf(`${projectRootPath}/data/sqlite/*.db*`, { glob: true });

    compose = await new DockerComposeEnvironment(
      projectRootPath,
      'docker-compose.yaml',
    )
      .withEnvironment({
        START_HEIGHT: '0',
        STOP_HEIGHT: '0',
      })
      .withBuild()
      .withWaitStrategy('core-1', Wait.forHttp('/ar-io/info', 4000))
      .up(['core']);
  });

  after(async function () {
    await compose.down();
    // await rimraf(`${projectRootPath}/data/sqlite/*.db*`, { glob: true });
  });

  it('Verifying that /raw/<id> returns expected response', async function () {
    // expected headers:
    // x-ar-io-hops: 1
    // content-type: application/x.arweave-manifest+json
    // content-length: 7424
    // expected status code: 200
    // expected content: ta_6L_z8TOmthittUmGpYjcAbvOzPRVhcw36m-oYsQ8
    const hasher = crypto.createHash('sha256');

    const res = await axios.get(`http://localhost:4000/raw/${tx1}`, {
      responseType: 'stream',
    });

    const stream = res.data;

    stream.on('data', (data: any) => {
      hasher.update(data);
    });

    stream.on('end', () => {
      assert.equal(res.headers['x-ar-io-hops'], '1');
      assert.equal(
        res.headers['content-type'],
        'application/x.arweave-manifest+json',
      );
      assert.equal(res.headers['content-length'], '7424');
      assert.equal(res.status, 200);
      assert.equal(
        hasher.digest('base64url'),
        'ta_6L_z8TOmthittUmGpYjcAbvOzPRVhcw36m-oYsQ8',
      );
    });
  });

  it('Verifying that /<id> for a manifest with a missing index returns 404', async function () {
    const res = await axios.get(`http://localhost:4000/${tx1}`, {
      validateStatus: (status) => status === 404,
    });
    assert.equal(res.status, 404);
  });

  it('verifying that /<id> for a manifest with a valid index returns 301', async function () {
    const res = await axios.get(`http://localhost:4000/${tx2}`, {
      maxRedirects: 0,
      validateStatus: (status) => status === 301,
    });
    assert.equal(res.status, 301);
  });

  it('Verifying that /<id>/ for a manifest with a valid index returns expected response', async function () {
    // expected headers:
    // x-ar-io-hops: 1
    // content-type: text/html; charset=utf-8
    // content-length: 3922
    // expected status code: 200
    // expected content: R5xJqIIKrqxuUJy5ig0_zqKBoDzyORnxAJ0Ayve3Ig0
    const hasher = crypto.createHash('sha256');
    const res = await axios.get(`http://localhost:4000/${tx2}`, {
      responseType: 'stream',
    });

    const stream = res.data;

    stream.on('data', (data: any) => {
      hasher.update(data);
    });

    stream.on('end', () => {
      assert.equal(res.headers['x-ar-io-hops'], '1');
      assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
      assert.equal(res.headers['content-length'], '3922');
      assert.equal(res.status, 200);
      assert.equal(
        hasher.digest('base64url'),
        'R5xJqIIKrqxuUJy5ig0_zqKBoDzyORnxAJ0Ayve3Ig0',
      );
    });
  });

  it('Verifying that /<id>/<path> for a valid manifest path returns expected response', async function () {
    // expected headers:
    // x-ar-io-hops: 1
    // content-type: application/json; charset=utf-8
    // content-length: 130
    // expected status code: 200
    // expected content: gkOH8JBTdKr_wD9SriwYwCM6p7saQAJFU60AREREQLA
    const hasher = crypto.createHash('sha256');
    const res = await axios.get(`http://localhost:4000/${tx1}/0`, {
      responseType: 'stream',
    });

    const stream = res.data;

    stream.on('data', (data: any) => {
      hasher.update(data);
    });

    stream.on('end', () => {
      assert.equal(res.headers['x-ar-io-hops'], '1');
      assert.equal(
        res.headers['content-type'],
        'application/json; charset=utf-8',
      );
      assert.equal(res.headers['content-length'], '130');
      assert.equal(res.status, 200);
      assert.equal(
        hasher.digest('base64url'),
        'gkOH8JBTdKr_wD9SriwYwCM6p7saQAJFU60AREREQLA',
      );
    });
  });

  it('Verifying that /<id> for a non-manifest returns expected response', async function () {
    // expected headers:
    // x-ar-io-hops: 1
    // content-type: application/json; charset=utf-8
    // content-length: 130
    // expected status code: 200
    // expected content: gkOH8JBTdKr_wD9SriwYwCM6p7saQAJFU60AREREQLA
    const hasher = crypto.createHash('sha256');
    const res = await axios.get(`http://localhost:4000/${tx3}`, {
      responseType: 'stream',
    });

    const stream = res.data;

    stream.on('data', (data: any) => {
      hasher.update(data);
    });

    stream.on('end', () => {
      assert.equal(res.headers['x-ar-io-hops'], '1');
      assert.equal(
        res.headers['content-type'],
        'application/json; charset=utf-8',
      );
      assert.equal(res.headers['content-length'], '130');
      assert.equal(res.status, 200);
      assert.equal(
        hasher.digest('base64url'),
        'gkOH8JBTdKr_wD9SriwYwCM6p7saQAJFU60AREREQLA',
      );
    });
  });

  it('Verifying that /<id>/<path> for a manifest path with a trailing slash returns expected response', async function () {
    // expected headers:
    // x-ar-io-hops: 1
    // expected status code: 200
    const res = await axios.get(
      `http://localhost:4000/${tx4}/blog/a-fresh-start/`,
    );

    assert.equal(res.headers['x-ar-io-hops'], '1');
    assert.equal(res.status, 200);
  });

  it('Verifying that /<id>/<path> for a manifest path without a trailing slash returns expected response', async function () {
    // expected headers:
    // x-ar-io-hops: 1
    // expected status code: 200
    const res = await axios.get(
      `http://localhost:4000/${tx4}/blog/a-fresh-start`,
    );

    assert.equal(res.headers['x-ar-io-hops'], '1');
    assert.equal(res.status, 200);
  });
});

describe('X-Cache header', function () {
  let compose: StartedDockerComposeEnvironment;

  before(async function () {
    await rimraf(`${projectRootPath}/data/sqlite/*.db*`, { glob: true });
  });

  // after(async function () {
  //   await rimraf(`${projectRootPath}/data/sqlite/*.db*`, { glob: true });
  // });

  beforeEach(async function () {
    compose = await new DockerComposeEnvironment(
      projectRootPath,
      'docker-compose.yaml',
    )
      .withEnvironment({
        START_HEIGHT: '0',
        STOP_HEIGHT: '0',
      })
      .withBuild()
      .withWaitStrategy('core-1', Wait.forHttp('/ar-io/info', 4000))
      .up(['core']);
  });

  afterEach(async function () {
    await compose.down();
  });

  it('Verifying x-cache header when no cache available', async function () {
    const res = await axios.get(`http://localhost:4000/raw/${tx1}`);

    assert.equal(res.headers['x-cache'], 'MISS');
  });

  it('Verifying x-cache header when cache is available', async function () {
    const res = await axios.get(`http://localhost:4000/raw/${tx1}`);

    assert.equal(res.headers['x-cache'], 'HIT');
  });
});

describe('X-AR-IO-Hops and X-Ar-IO-Origin headers', function () {
  describe('with ARNS_ROOT_HOST', function () {
    let compose: StartedDockerComposeEnvironment;

    before(async function () {
      await rimraf(`${projectRootPath}/data/sqlite/*.db*`, { glob: true });

      compose = await new DockerComposeEnvironment(
        projectRootPath,
        'docker-compose.yaml',
      )
        .withEnvironment({
          START_HEIGHT: '0',
          STOP_HEIGHT: '0',
          ARNS_ROOT_HOST: 'ar-io.localhost',
        })
        .withBuild()
        .withWaitStrategy('core-1', Wait.forHttp('/ar-io/info', 4000))
        .up(['core']);
    });

    after(async function () {
      await compose.down();
      // await rimraf(`${projectRootPath}/data/sqlite/*.db*`, { glob: true });
    });

    it('Verifying that /raw/<id> returns expected response', async function () {
      const res = await axios.get(`http://localhost:4000/raw/${tx3}`);

      assert.equal(res.headers['x-ar-io-hops'], '1');
      assert.equal(res.headers['x-ar-io-origin'], 'ar-io.localhost');

      const resWithHeaders = await axios.get(
        `http://localhost:4000/raw/${tx3}`,
        {
          headers: {
            'X-AR-IO-Hops': '5',
            'X-Ar-IO-Origin': 'another-host',
          },
        },
      );

      assert.equal(resWithHeaders.headers['x-ar-io-hops'], '6');
      assert.equal(resWithHeaders.headers['x-ar-io-origin'], 'another-host');
    });

    it('Verifying that /<id> for a manifest with a missing index returns no hops and origin', async function () {
      const res = await axios.get(`http://localhost:4000/${tx1}`, {
        validateStatus: () => true,
        headers: {
          Host: 'rxlroexuz2jequt4mtk4y5tyqdlhlhzxzlqmvwzmuk4sc2aoqm3a.ar-io.localhost',
        },
      });

      assert.equal(res.headers['x-ar-io-hops'], undefined);
      assert.equal(res.headers['x-ar-io-origin'], undefined);
    });

    it('verifying that /<id> for a manifest with a valid index returns hops and origin', async function () {
      const res = await axios.get(`http://localhost:4000/${tx2}/`, {
        headers: {
          Host: 'zhtq6zlaiu54cz5ss7vqxlf7yquechmhzcpmwccmrcu7w44f4zbq.ar-io.localhost',
        },
      });

      assert.equal(res.headers['x-ar-io-hops'], '1');
      assert.equal(res.headers['x-ar-io-origin'], 'ar-io.localhost');

      const resWithHeaders = await axios.get(`http://localhost:4000/${tx2}/`, {
        headers: {
          Host: 'zhtq6zlaiu54cz5ss7vqxlf7yquechmhzcpmwccmrcu7w44f4zbq.ar-io.localhost',
          'X-AR-IO-Hops': '2',
          'X-Ar-IO-Origin': 'another-host',
        },
      });

      assert.equal(resWithHeaders.headers['x-ar-io-hops'], '3');
      assert.equal(resWithHeaders.headers['x-ar-io-origin'], 'another-host');
    });

    it('Verifying that /<id> for a non-manifest returns hops and origin', async function () {
      const res = await axios.get(`http://localhost:4000/${tx3}`, {
        headers: {
          Host: 'sw3yqmkl5ajki5vl5jflcpqy43opvgtpngs6tel3eltuhq73l2jq.ar-io.localhost',
        },
      });

      assert.equal(res.headers['x-ar-io-hops'], '1');
      assert.equal(res.headers['x-ar-io-origin'], 'ar-io.localhost');

      const resWithHeaders = await axios.get(`http://localhost:4000/${tx3}`, {
        headers: {
          'X-AR-IO-Hops': '5',
          'X-Ar-IO-Origin': 'another-host',
          Host: 'sw3yqmkl5ajki5vl5jflcpqy43opvgtpngs6tel3eltuhq73l2jq.ar-io.localhost',
        },
      });

      assert.equal(resWithHeaders.headers['x-ar-io-hops'], '6');
      assert.equal(resWithHeaders.headers['x-ar-io-origin'], 'another-host');
    });
  });

  describe('without ARNS_ROOT_HOST', function () {
    let compose: StartedDockerComposeEnvironment;

    before(async function () {
      await rimraf(`${projectRootPath}/data/sqlite/*.db*`, { glob: true });

      compose = await new DockerComposeEnvironment(
        projectRootPath,
        'docker-compose.yaml',
      )
        .withEnvironment({
          START_HEIGHT: '0',
          STOP_HEIGHT: '0',
        })
        .withBuild()
        .withWaitStrategy('core-1', Wait.forHttp('/ar-io/info', 4000))
        .up(['core']);
    });

    after(async function () {
      await compose.down();
      // await rimraf(`${projectRootPath}/data/sqlite/*.db*`, { glob: true });
    });

    it('Verifying that /raw/<id> returns expected response', async function () {
      const res = await axios.get(`http://localhost:4000/raw/${tx3}`);

      assert.equal(res.headers['x-ar-io-hops'], '1');
      assert.equal(res.headers['x-ar-io-origin'], undefined);

      const resWithHeaders = await axios.get(
        `http://localhost:4000/raw/${tx3}`,
        {
          headers: {
            'X-AR-IO-Hops': '5',
            'X-Ar-IO-Origin': 'another-host',
          },
        },
      );

      assert.equal(resWithHeaders.headers['x-ar-io-hops'], '6');
      assert.equal(resWithHeaders.headers['x-ar-io-origin'], 'another-host');
    });

    it('Verifying that /<id> for a manifest with a missing index returns no hops and origin', async function () {
      const res = await axios.get(`http://localhost:4000/${tx1}`, {
        validateStatus: () => true,
      });

      assert.equal(res.headers['x-ar-io-hops'], undefined);
      assert.equal(res.headers['x-ar-io-origin'], undefined);
    });

    it('verifying that /<id> for a manifest with a valid index returns hops and origin', async function () {
      const res = await axios.get(`http://localhost:4000/${tx2}/`, {
        headers: {
          Host: 'zhtq6zlaiu54cz5ss7vqxlf7yquechmhzcpmwccmrcu7w44f4zbq.ar-io.localhost',
        },
      });

      assert.equal(res.headers['x-ar-io-hops'], '1');
      assert.equal(res.headers['x-ar-io-origin'], undefined);

      const resWithHeaders = await axios.get(`http://localhost:4000/${tx2}/`, {
        headers: {
          Host: 'zhtq6zlaiu54cz5ss7vqxlf7yquechmhzcpmwccmrcu7w44f4zbq.ar-io.localhost',
          'X-AR-IO-Hops': '2',
          'X-Ar-IO-Origin': 'another-host',
        },
      });

      assert.equal(resWithHeaders.headers['x-ar-io-hops'], '3');
      assert.equal(resWithHeaders.headers['x-ar-io-origin'], 'another-host');
    });

    it('Verifying that /<id> for a non-manifest returns hops and origin', async function () {
      const res = await axios.get(`http://localhost:4000/${tx3}`, {
        headers: {
          Host: 'sw3yqmkl5ajki5vl5jflcpqy43opvgtpngs6tel3eltuhq73l2jq.ar-io.localhost',
        },
      });

      assert.equal(res.headers['x-ar-io-hops'], '1');
      assert.equal(res.headers['x-ar-io-origin'], undefined);

      const resWithHeaders = await axios.get(`http://localhost:4000/${tx3}`, {
        headers: {
          'X-AR-IO-Hops': '5',
          'X-Ar-IO-Origin': 'another-host',
          Host: 'sw3yqmkl5ajki5vl5jflcpqy43opvgtpngs6tel3eltuhq73l2jq.ar-io.localhost',
        },
      });

      assert.equal(resWithHeaders.headers['x-ar-io-hops'], '6');
      assert.equal(resWithHeaders.headers['x-ar-io-origin'], 'another-host');
    });
  });

  describe('with fake trusted node', function () {
    let fakeGateway: Server;
    let containerBuilder: GenericContainer;
    let core: StartedTestContainer;
    let corePort: number;

    before(async function () {
      fakeGateway = createServer((req, res) => {
        const hops = req.headers['x-ar-io-hops'] as string;
        const origin = req.headers['x-ar-io-origin'] as string;
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Content-Length': '11',
          'X-AR-IO-Hops': hops ? (parseInt(hops) + 1).toString() : '1',
          'X-AR-IO-Origin': origin ?? 'fake-gateway',
        });
        res.end('hello world');
      });
      fakeGateway.listen(4001);

      containerBuilder = await GenericContainer.fromDockerfile(
        projectRootPath,
      ).build('core', { deleteOnExit: false });

      await TestContainers.exposeHostPorts(4001);
    });

    after(async function () {
      fakeGateway.close();
      // await rimraf(`${projectRootPath}/data/sqlite/*.db*`, { glob: true });
    });

    beforeEach(async function () {
      await rimraf(`${projectRootPath}/data/sqlite/*.db*`, { glob: true });

      core = await containerBuilder
        .withEnvironment({
          START_HEIGHT: '0',
          STOP_HEIGHT: '0',
          ARNS_ROOT_HOST: 'ar-io.localhost',
          TRUSTED_GATEWAY_URL: 'http://host.testcontainers.internal:4001',
        })
        .withExposedPorts(4000)
        .withWaitStrategy(Wait.forHttp('/ar-io/info', 4000))
        .start();

      corePort = core.getMappedPort(4000);
    });

    afterEach(async function () {
      await core.stop();
    });

    it('Verifying that /raw/<id> returns expected response', async function () {
      const req = await axios.get(`http://localhost:${corePort}/raw/${tx2}`);

      assert.equal(req.headers['x-ar-io-hops'], '2');
      assert.equal(req.headers['x-ar-io-origin'], 'ar-io.localhost');

      const reqWithHeaders = await axios.get(
        `http://localhost:${corePort}/raw/${tx3}`,
        {
          headers: {
            'X-AR-IO-Hops': '5',
            'X-Ar-IO-Origin': 'another-host',
          },
        },
      );

      assert.equal(reqWithHeaders.headers['x-ar-io-hops'], '7');
      assert.equal(reqWithHeaders.headers['x-ar-io-origin'], 'another-host');
    });

    it('Verifying that /<id> returns expected response', async function () {
      const req = await axios.get(`http://localhost:${corePort}/${tx2}`, {
        headers: {
          Host: 'zhtq6zlaiu54cz5ss7vqxlf7yquechmhzcpmwccmrcu7w44f4zbq.ar-io.localhost',
        },
      });
      assert.equal(req.headers['x-ar-io-hops'], '2');
      assert.equal(req.headers['x-ar-io-origin'], 'ar-io.localhost');

      const reqWithHeaders = await axios.get(
        `http://localhost:${corePort}/${tx3}`,
        {
          headers: {
            Host: 'sw3yqmkl5ajki5vl5jflcpqy43opvgtpngs6tel3eltuhq73l2jq.ar-io.localhost',
            'X-AR-IO-Hops': '10',
            'X-Ar-IO-Origin': 'another-host',
          },
        },
      );

      assert.equal(reqWithHeaders.headers['x-ar-io-hops'], '12');
      assert.equal(reqWithHeaders.headers['x-ar-io-origin'], 'another-host');
    });
  });
});
