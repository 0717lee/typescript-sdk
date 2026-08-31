/**
 * Issue #2723 — a prompt, resource, or resource-template handle must keep
 * `remove()` working after a rename. The update closure's captured registry
 * key has to move with the entry; otherwise the removal targets the stale
 * original key while the renamed entry stays listed and callable.
 */
import { describe, expect, it } from 'vitest';

import { invoke } from '../../src/server/invoke';
import { McpServer, ResourceTemplate } from '../../src/server/mcp';

const LEGACY = { classification: { era: 'legacy' as const } };

const list = async (
    server: McpServer,
    method: string,
    key: string,
    field: 'name' | 'uri'
): Promise<string[]> => {
    const response = await invoke(server, { jsonrpc: '2.0', id: 1, method, params: {} }, LEGACY);
    const body = (await response.json()) as {
        result: Record<string, Array<{ name?: string; uri?: string }>>;
    };
    return body.result[key]!.map(item => item[field]!);
};

describe('registered handles stay removable after rename (#2723)', () => {
    it('a prompt renamed twice is listed once under the new name and removed entirely', async () => {
        const server = new McpServer({ name: 's', version: '0' });
        const handle = server.registerPrompt('first', {}, () => ({ messages: [] }));

        handle.update({ name: 'second' });
        handle.update({ name: 'third' });
        expect(await list(server, 'prompts/list', 'prompts', 'name')).toEqual(['third']);

        handle.remove();
        expect(await list(server, 'prompts/list', 'prompts', 'name')).toEqual([]);

        // The renamed-away entry must no longer answer calls.
        const response = await invoke(
            server,
            { jsonrpc: '2.0', id: 1, method: 'prompts/get', params: { name: 'second' } },
            LEGACY
        );
        const body = (await response.json()) as { error?: unknown };
        expect(body.error).toBeDefined();
    });

    it('a renamed resource template is removed from its live key', async () => {
        const server = new McpServer({ name: 's', version: '0' });
        const handle = server.registerResource(
            'first',
            new ResourceTemplate('test://{id}', { list: undefined }),
            {},
            async () => ({ contents: [] })
        );

        handle.update({ name: 'second' });
        expect(await list(server, 'resources/templates/list', 'resourceTemplates', 'name')).toEqual(['second']);

        handle.remove();
        expect(await list(server, 'resources/templates/list', 'resourceTemplates', 'name')).toEqual([]);
    });

    it('a resource moved to a new uri is removed from the new uri', async () => {
        const server = new McpServer({ name: 's', version: '0' });
        const handle = server.registerResource('config', 'config://app', {}, async uri => ({
            contents: [{ uri: uri.href, text: 'config' }]
        }));

        handle.update({ uri: 'config://moved' });
        expect(await list(server, 'resources/list', 'resources', 'uri')).toEqual(['config://moved']);

        handle.remove();
        expect(await list(server, 'resources/list', 'resources', 'uri')).toEqual([]);
    });
});
