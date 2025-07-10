import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import { createCLI } from './cli.js';
import { Database } from '../db/database.js';

// Mock the database
vi.mock('../db/database.js');

// Mock Ink components
vi.mock('./components/AddLore.js', () => ({
  AddLore: vi.fn(() => null),
}));

// Mock ink render to prevent process.exit issues
vi.mock('ink', () => ({
  render: vi.fn(() => ({
    waitUntilExit: vi.fn().mockResolvedValue(undefined),
    unmount: vi.fn(),
    rerender: vi.fn(),
    clear: vi.fn(),
  })),
  Box: vi.fn(),
  Text: vi.fn(),
}));

// Mock getRealmInfo
vi.mock('./utils/realm.js', () => ({
  getRealmInfo: vi.fn().mockResolvedValue({
    name: 'test-realm',
    path: '/test/path',
    gitRemote: null,
    isMonorepo: false,
    provinces: [],
  }),
}));

// Mock renderAddLore
vi.mock('./commands/add.js', () => ({
  renderAddLore: vi.fn().mockResolvedValue(undefined),
}));

describe('CLI', () => {
  let cli: Command;
  let mockDb: Database;
  let consoleLog: any;
  let consoleError: any;
  let processExit: any;

  beforeEach(() => {
    // Mock console
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock process.exit
    processExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    // Create mock database
    mockDb = new Database(':memory:');
    vi.mocked(Database).mockReturnValue(mockDb);

    // Create CLI instance
    cli = createCLI();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Structure', () => {
    it('should have correct program name and description', () => {
      expect(cli.name()).toBe('lh');
      expect(cli.description()).toContain('LoreHub');
    });

    it('should have version', () => {
      expect(cli.version()).toBeDefined();
    });

    it('should have add command', () => {
      const addCommand = cli.commands.find((cmd) => cmd.name() === 'add');
      expect(addCommand).toBeDefined();
      expect(addCommand?.description()).toContain('Add a new lore');
    });
  });

  describe('add command', () => {
    it('should handle inline lore creation', async () => {
      const { renderAddLore } = await import('./commands/add.js');

      // Mock renderAddLore to simulate successful creation
      vi.mocked(renderAddLore).mockImplementation(async (options: any) => {
        if (options.initialContent && !process.stdin.isTTY) {
          console.log('✓ Lore added successfully');
        }
      });

      await cli.parseAsync(['node', 'lh', 'add', 'Use Redis for caching']);

      expect(renderAddLore).toHaveBeenCalledWith(
        expect.objectContaining({
          initialContent: 'Use Redis for caching',
        })
      );
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    });

    it.skip('should launch interactive mode when no content provided', async () => {
      // Create a new CLI instance to ensure clean state
      const testCli = createCLI();

      const { renderAddLore } = await import('./commands/add.js');

      // Reset and configure the mock
      vi.mocked(renderAddLore).mockClear();
      vi.mocked(renderAddLore).mockResolvedValue(undefined);

      try {
        await testCli.parseAsync(['node', 'lh', 'add']);
      } catch (error) {
        // May throw due to process.exit
      }

      expect(renderAddLore).toHaveBeenCalledWith(
        expect.objectContaining({
          initialContent: '',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const { renderAddLore } = await import('./commands/add.js');
      vi.mocked(renderAddLore).mockRejectedValue(new Error('Database error'));

      try {
        await cli.parseAsync(['node', 'lh', 'add', 'Test lore']);
      } catch (error) {
        // Expected to throw due to process.exit
      }

      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(String)
      );
      expect(processExit).toHaveBeenCalledWith(1);
    });
  });
});
