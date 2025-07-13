import React from 'react';
import { Command } from 'commander';
import { Database } from '../../db/database.js';
import { getDbPath } from '../utils/db-config.js';
import { GitSyncAdapter } from '../../sync/git-sync-adapter.js';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import type { Workspace } from '../../core/types.js';

export const syncCommand = new Command('sync')
  .description('Sync lores with remote repositories');

syncCommand
  .command('init [workspace]')
  .description('Initialize sync for a workspace')
  .action(async (workspaceName?: string) => {
    try {
      const db = new Database(getDbPath());
      
      let workspace: Workspace | null;
      if (workspaceName) {
        workspace = db.findWorkspaceByName(workspaceName);
        if (!workspace) {
          console.log(chalk.red(`Workspace '${workspaceName}' not found`));
          db.close();
          return;
        }
      } else {
        // Use default workspace or prompt
        workspace = db.getDefaultWorkspace();
        if (!workspace) {
          const workspaces = db.listWorkspaces();
          if (workspaces.length === 0) {
            console.log(chalk.yellow('No workspaces found. Create one with: lh workspace create'));
            db.close();
            return;
          }
          
          const response = await prompts({
            type: 'select',
            name: 'workspaceId',
            message: 'Select workspace to initialize sync:',
            choices: workspaces.map((ws: Workspace) => ({
              title: ws.name,
              value: ws.id,
            })),
          });
          
          if (!response.workspaceId) {
            console.log(chalk.yellow('Sync initialization cancelled'));
            db.close();
            return;
          }
          
          workspace = db.findWorkspace(response.workspaceId);
        }
      }
      
      if (!workspace) {
        console.log(chalk.red('Workspace not found'));
        db.close();
        return;
      }
      
      if (!workspace.syncEnabled) {
        console.log(chalk.yellow(`Sync is disabled for workspace '${workspace.name}'`));
        console.log(chalk.gray('Enable sync with: lh workspace edit ' + workspace.name + ' --sync'));
        db.close();
        return;
      }
      
      const spinner = ora(`Initializing sync for workspace '${workspace.name}'...`).start();
      
      try {
        const syncAdapter = new GitSyncAdapter(workspace, db);
        await syncAdapter.initialize();
        
        spinner.succeed(chalk.green(`Sync initialized for workspace '${workspace.name}'`));
        
        if (workspace.syncRepo) {
          console.log(chalk.gray(`Remote: ${workspace.syncRepo}`));
        } else {
          console.log(chalk.yellow('No remote repository configured'));
          console.log(chalk.gray('Add a remote with: lh workspace edit ' + workspace.name + ' --sync-repo <url>'));
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to initialize sync'));
        console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      }
      
      db.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

syncCommand
  .command('push [workspace]')
  .description('Push local changes to remote')
  .action(async (workspaceName?: string) => {
    try {
      const db = new Database(getDbPath());
      
      let workspace: Workspace | null;
      if (workspaceName) {
        workspace = db.findWorkspaceByName(workspaceName);
      } else {
        workspace = db.getDefaultWorkspace();
      }
      
      if (!workspace) {
        console.log(chalk.red('No workspace specified and no default workspace found'));
        db.close();
        return;
      }
      
      if (!workspace.syncEnabled || !workspace.syncRepo) {
        console.log(chalk.yellow(`Sync not configured for workspace '${workspace.name}'`));
        db.close();
        return;
      }
      
      const spinner = ora('Pushing changes...').start();
      
      try {
        const syncAdapter = new GitSyncAdapter(workspace, db);
        await syncAdapter.initialize();
        
        // Export current data
        await syncAdapter.exportWorkspaceData();
        
        // Push changes
        const result = await syncAdapter.push();
        
        if (result.errors.length > 0) {
          spinner.fail(chalk.red('Push failed'));
          result.errors.forEach(err => console.error(chalk.red(`  ${err}`)));
        } else if (result.pushed === 0) {
          spinner.info('No changes to push');
        } else {
          spinner.succeed(chalk.green(`Pushed ${result.pushed} changes`));
        }
      } catch (error) {
        spinner.fail(chalk.red('Push failed'));
        console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      }
      
      db.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

syncCommand
  .command('pull [workspace]')
  .description('Pull changes from remote')
  .action(async (workspaceName?: string) => {
    try {
      const db = new Database(getDbPath());
      
      let workspace: Workspace | null;
      if (workspaceName) {
        workspace = db.findWorkspaceByName(workspaceName);
      } else {
        workspace = db.getDefaultWorkspace();
      }
      
      if (!workspace) {
        console.log(chalk.red('No workspace specified and no default workspace found'));
        db.close();
        return;
      }
      
      if (!workspace.syncEnabled || !workspace.syncRepo) {
        console.log(chalk.yellow(`Sync not configured for workspace '${workspace.name}'`));
        db.close();
        return;
      }
      
      const spinner = ora('Pulling changes...').start();
      
      try {
        const syncAdapter = new GitSyncAdapter(workspace, db);
        await syncAdapter.initialize();
        
        const result = await syncAdapter.pull();
        
        if (result.errors.length > 0) {
          spinner.fail(chalk.red('Pull failed'));
          result.errors.forEach(err => console.error(chalk.red(`  ${err}`)));
        } else if (result.conflicts > 0) {
          spinner.warn(chalk.yellow(`Pull completed with ${result.conflicts} conflicts`));
          console.log(chalk.yellow('Manual conflict resolution required'));
        } else if (result.pulled === 0) {
          spinner.info('Already up to date');
        } else {
          spinner.succeed(chalk.green(`Pulled ${result.pulled} changes`));
        }
      } catch (error) {
        spinner.fail(chalk.red('Pull failed'));
        console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      }
      
      db.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

syncCommand
  .command('status [workspace]')
  .description('Show sync status')
  .action(async (workspaceName?: string) => {
    try {
      const db = new Database(getDbPath());
      
      let workspace: Workspace | null;
      if (workspaceName) {
        workspace = db.findWorkspaceByName(workspaceName);
      } else {
        workspace = db.getDefaultWorkspace();
      }
      
      if (!workspace) {
        console.log(chalk.red('No workspace specified and no default workspace found'));
        db.close();
        return;
      }
      
      console.log(chalk.bold(`\nSync Status for '${workspace.name}':`));
      console.log(chalk.gray('─'.repeat(40)));
      
      if (!workspace.syncEnabled) {
        console.log(chalk.yellow('Sync disabled'));
        db.close();
        return;
      }
      
      console.log(`Remote: ${workspace.syncRepo || chalk.gray('Not configured')}`);
      console.log(`Branch: ${workspace.syncBranch}`);
      console.log(`Auto-sync: ${workspace.autoSync ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
      
      if (workspace.autoSync) {
        console.log(`Sync interval: ${workspace.syncInterval}s`);
      }
      
      // TODO: Show actual sync status (last sync, pending changes, etc.)
      
      db.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

export default syncCommand;