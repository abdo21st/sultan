import { execFileSync } from 'node:child_process';

// Credentials stay inside each container and are never command-line arguments.
const apps = ['sultan-production-sultan-app-1', 'sultan-mobile-acceptance-sultan-app-1', 'sultan-training-video-app-1'];
let failed = false;
for (const app of apps) {
    try {
        const source = `
            (async () => {
                if (!process.env.CRON_SECRET) throw Error('Cron secret is missing.');
                const response = await fetch('http://127.0.0.1:3000/api/cron/alerts', {
                    headers: { Authorization: 'Bearer ' + process.env.CRON_SECRET },
                    signal: AbortSignal.timeout(55000),
                });
                if (!response.ok) throw Error('Scheduled alerts returned ' + response.status);
                console.log(JSON.stringify(await response.json()));
            })().catch(() => { console.error('Scheduled alerts failed.'); process.exitCode = 1; });
        `;
        const result = execFileSync('docker', ['exec', app, 'node', '-e', source], {
            encoding: 'utf8', timeout: 65000, stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
        console.log(JSON.stringify({ app, result: JSON.parse(result) }));
    } catch {
        failed = true;
        console.error(JSON.stringify({ app, error: 'SCHEDULED_ALERTS_FAILED' }));
    }
}
if (failed) process.exitCode = 1;
