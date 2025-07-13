import React from 'react';
import { Box, Text } from 'ink';
import { Command } from 'commander';
import { Database } from '../../db/database.js';
import { getDbPath } from '../utils/db-config.js';
import prompts from 'prompts';
import chalk from 'chalk';
import type { Workspace, Realm } from '../../core/types.js';

export const workspaceCommand = new Command('workspace')
  .alias('ws')
  .description('Manage workspaces for organizing realms');

workspaceCommand
  .command('list')
  .alias('ls')
  .description('List all workspaces')
  .action(async () => {
    try {
      const db = new Database(getDbPath());
      const workspaces = db.listWorkspaces();
      
      if (workspaces.length === 0) {
        console.log(chalk.yellow('No workspaces found. Create one with: lh workspace create'));
        return;
      }
      
      console.log('\nWorkspaces:\n');
      
      workspaces.forEach((ws: Workspace, index: number) => {
        const name = ws.isDefault ? chalk.bold(`${ws.name} ${chalk.green('(default)')}`) : ws.name;
        const syncStatus = ws.syncEnabled ? chalk.green('✓ Sync enabled') : chalk.gray('✗ Sync disabled');
        const realmCount = db.getWorkspaceRealms(ws.id).length;
        
        console.log(`${chalk.bold(`${index + 1}.`)} ${name}`);
        console.log(`   ${syncStatus}`);
        if (ws.syncRepo) {
          console.log(`   Repo: ${chalk.cyan(ws.syncRepo)}`);
        }
        console.log(`   Realms: ${realmCount}`);
        if (ws.autoSync) {
          console.log(`   Auto-sync: every ${ws.syncInterval}s`);
        }
        console.log();
      });
      
      db.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

workspaceCommand
  .command('create [name]')
  .description('Create a new workspace')
  .option('--sync-repo <url>', 'Git repository for sync')
  .option('--no-sync', 'Disable sync for this workspace')
  .option('--default', 'Set as default workspace')
  .option('--interval <seconds>', 'Sync interval in seconds', '300')
  .action(async (name?: string, options?: any) => {
    try {
      const db = new Database(getDbPath());
      
      // Interactive prompts if name not provided
      if (!name) {
        const response = await prompts([
          {
            type: 'text',
            name: 'name',
            message: 'Workspace name:',
            validate: (value: string) => value.length > 0 && value.length <= 50,
          },
          {
            type: 'confirm',
            name: 'syncEnabled',
            message: 'Enable sync for this workspace?',
            initial: true,
          },
          {
            type: (prev) => prev ? 'text' : null,
            name: 'syncRepo',
            message: 'Git repository URL for sync:',
            validate: (value: string) => !value || value.startsWith('http') || value.startsWith('git@'),
          },
        ]);
        
        if (!response.name) {
          console.log(chalk.yellow('Workspace creation cancelled'));
          return;
        }
        
        name = response.name;
        options = {
          ...options,
          sync: response.syncEnabled,
          syncRepo: response.syncRepo,
        };
      }
      
      const workspace = db.createWorkspace({
        name: name!,  // name is guaranteed to be defined at this point
        syncEnabled: options.sync !== false,
        syncRepo: options.syncRepo,
        syncInterval: parseInt(options.interval),
        isDefault: options.default,
      });
      
      console.log(chalk.green(`✓ Created workspace '${workspace.name}'`));
      
      if (workspace.isDefault) {
        console.log(chalk.blue('  Set as default workspace'));
      }
      
      if (workspace.syncEnabled && workspace.syncRepo) {
        console.log(chalk.blue(`  Sync enabled with: ${workspace.syncRepo}`));
      }
      
      db.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

workspaceCommand
  .command('show [name]')
  .description('Show workspace details')
  .action(async (name?: string) => {
    try {
      const db = new Database(getDbPath());
      
      let workspace;
      if (name) {
        workspace = db.findWorkspaceByName(name);
        if (!workspace) {
          console.log(chalk.red(`Workspace '${name}' not found`));
          return;
        }
      } else {
        workspace = db.getDefaultWorkspace();
        if (!workspace) {
          console.log(chalk.yellow('No default workspace. Create one with: lh workspace create'));
          return;
        }
      }
      
      console.log(chalk.bold(`\nWorkspace: ${workspace.name}`));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`ID: ${workspace.id}`);
      console.log(`Default: ${workspace.isDefault ? chalk.green('Yes') : 'No'}`);
      console.log(`Sync Enabled: ${workspace.syncEnabled ? chalk.green('Yes') : chalk.red('No')}`);
      
      if (workspace.syncEnabled) {
        console.log(`Sync Repo: ${workspace.syncRepo || chalk.gray('Not configured')}`);
        console.log(`Sync Branch: ${workspace.syncBranch}`);
        console.log(`Auto Sync: ${workspace.autoSync ? 'Yes' : 'No'}`);
        console.log(`Sync Interval: ${workspace.syncInterval}s`);
      }
      
      if (workspace.filters) {
        console.log('\nFilters:');
        if (workspace.filters.types) {
          console.log(`  Types: ${workspace.filters.types.join(', ')}`);
        }
        if (workspace.filters.minConfidence !== undefined) {
          console.log(`  Min Confidence: ${workspace.filters.minConfidence}%`);
        }
        if (workspace.filters.includeSigils) {
          console.log(`  Include Sigils: ${workspace.filters.includeSigils.join(', ')}`);
        }
        if (workspace.filters.excludeSigils) {
          console.log(`  Exclude Sigils: ${workspace.filters.excludeSigils.join(', ')}`);
        }
      }
      
      const realms = db.getWorkspaceRealms(workspace.id);
      console.log(`\nRealms (${realms.length}):`);
      if (realms.length > 0) {
        realms.forEach((realm: Realm) => {
          console.log(`  - ${realm.name} (${realm.path})`);
        });
      } else {
        console.log(chalk.gray('  No realms linked to this workspace'));
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

workspaceCommand
  .command('edit <name>')
  .description('Edit workspace configuration')
  .option('--name <newName>', 'Rename workspace')
  .option('--sync-repo <url>', 'Update sync repository')
  .option('--sync', 'Enable sync')
  .option('--no-sync', 'Disable sync')
  .option('--default', 'Set as default workspace')
  .option('--interval <seconds>', 'Update sync interval')
  .action(async (name: string, options: any) => {
    try {
      const db = new Database(getDbPath());
      const workspace = db.findWorkspaceByName(name);
      
      if (!workspace) {
        console.log(chalk.red(`Workspace '${name}' not found`));
        return;
      }
      
      const updates: any = {};
      
      if (options.name) updates.name = options.name;
      if (options.syncRepo !== undefined) updates.syncRepo = options.syncRepo;
      if (options.sync !== undefined) updates.syncEnabled = options.sync;
      if (options.default) updates.isDefault = true;
      if (options.interval) updates.syncInterval = parseInt(options.interval);
      
      const updated = db.updateWorkspace(workspace.id, updates);
      if (updated) {
        console.log(chalk.green(`✓ Updated workspace '${updated.name}'`));
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

workspaceCommand
  .command('delete <name>')
  .description('Delete a workspace')
  .option('-f, --force', 'Skip confirmation')
  .action(async (name: string, options: any) => {
    try {
      const db = new Database(getDbPath());
      const workspace = db.findWorkspaceByName(name);
      
      if (!workspace) {
        console.log(chalk.red(`Workspace '${name}' not found`));
        return;
      }
      
      const realms = db.getWorkspaceRealms(workspace.id);
      
      if (!options.force) {
        const response = await prompts({
          type: 'confirm',
          name: 'confirm',
          message: `Delete workspace '${name}'? ${realms.length > 0 ? `(${realms.length} realms will be unlinked)` : ''}`,
          initial: false,
        });
        
        if (!response.confirm) {
          console.log(chalk.yellow('Deletion cancelled'));
          return;
        }
      }
      
      db.deleteWorkspace(workspace.id);
      console.log(chalk.green(`✓ Deleted workspace '${name}'`));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

workspaceCommand
  .command('link [workspace]')
  .description('Link current realm to a workspace')
  .action(async (workspaceName?: string) => {
    try {
      const db = new Database(getDbPath());
      const currentRealm = db.getCurrentRealm();
      
      if (!currentRealm) {
        console.log(chalk.red('No realm found in current directory'));
        return;
      }
      
      let workspace;
      if (workspaceName) {
        workspace = db.findWorkspaceByName(workspaceName);
        if (!workspace) {
          console.log(chalk.red(`Workspace '${workspaceName}' not found`));
          return;
        }
      } else {
        // Interactive selection
        const workspaces = db.listWorkspaces();
        if (workspaces.length === 0) {
          console.log(chalk.yellow('No workspaces found. Create one with: lh workspace create'));
          return;
        }
        
        const response = await prompts({
          type: 'select',
          name: 'workspaceId',
          message: 'Select workspace:',
          choices: workspaces.map((ws: Workspace) => ({
            title: ws.isDefault ? `${ws.name} (default)` : ws.name,
            value: ws.id,
          })),
        });
        
        if (!response.workspaceId) {
          console.log(chalk.yellow('Link cancelled'));
          return;
        }
        
        workspace = db.findWorkspace(response.workspaceId);
      }
      
      if (workspace) {
        db.linkRealmToWorkspace(currentRealm.id, workspace.id);
        console.log(chalk.green(`✓ Linked realm '${currentRealm.name}' to workspace '${workspace.name}'`));
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

workspaceCommand
  .command('unlink [workspace]')
  .description('Unlink current realm from a workspace')
  .action(async (workspaceName?: string) => {
    try {
      const db = new Database(getDbPath());
      const currentRealm = db.getCurrentRealm();
      
      if (!currentRealm) {
        console.log(chalk.red('No realm found in current directory'));
        return;
      }
      
      const realmWorkspaces = db.getRealmWorkspaces(currentRealm.id);
      
      if (realmWorkspaces.length === 0) {
        console.log(chalk.yellow('This realm is not linked to any workspaces'));
        return;
      }
      
      let workspace: Workspace | undefined;
      if (workspaceName) {
        workspace = realmWorkspaces.find((ws: Workspace) => ws.name === workspaceName);
        if (!workspace) {
          console.log(chalk.red(`Realm is not linked to workspace '${workspaceName}'`));
          return;
        }
      } else {
        // Interactive selection
        const response = await prompts({
          type: 'select',
          name: 'workspaceId',
          message: 'Select workspace to unlink:',
          choices: realmWorkspaces.map((ws: Workspace) => ({
            title: ws.name,
            value: ws.id,
          })),
        });
        
        if (!response.workspaceId) {
          console.log(chalk.yellow('Unlink cancelled'));
          return;
        }
        
        workspace = realmWorkspaces.find((ws: Workspace) => ws.id === response.workspaceId);
      }
      
      if (workspace) {
        db.unlinkRealmFromWorkspace(currentRealm.id, workspace.id);
        console.log(chalk.green(`✓ Unlinked realm '${currentRealm.name}' from workspace '${workspace.name}'`));
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

export default workspaceCommand;