import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import { execSync } from 'child_process';

export interface ProjectInfo {
  name: string;
  path: string;
  gitRemote?: string;
  isMonorepo: boolean;
  services: string[];
}

export async function getProjectInfo(projectPath: string): Promise<ProjectInfo> {
  const name = await detectProjectName(projectPath);
  const gitRemote = detectGitRemote(projectPath);
  const { isMonorepo, services } = await detectMonorepoInfo(projectPath);

  return {
    name,
    path: projectPath,
    gitRemote,
    isMonorepo,
    services,
  };
}

async function detectProjectName(projectPath: string): Promise<string> {
  // Try package.json first
  try {
    const packageJsonPath = join(projectPath, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    if (packageJson.name) {
      return packageJson.name;
    }
  } catch {
    // Ignore error, try other methods
  }

  // Try Cargo.toml for Rust projects
  try {
    const cargoTomlPath = join(projectPath, 'Cargo.toml');
    const cargoToml = await readFile(cargoTomlPath, 'utf-8');
    const match = cargoToml.match(/name\s*=\s*"([^"]+)"/);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    // Ignore error
  }

  // Default to directory name
  return basename(projectPath);
}

function detectGitRemote(projectPath: string): string | undefined {
  try {
    const remote = execSync('git remote get-url origin', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    
    return remote || undefined;
  } catch {
    return undefined;
  }
}

async function detectMonorepoInfo(projectPath: string): Promise<{ isMonorepo: boolean; services: string[] }> {
  // Check for common monorepo indicators
  try {
    const packageJsonPath = join(projectPath, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    
    // Check for workspace configuration (npm/yarn/pnpm)
    if (packageJson.workspaces) {
      const services = await detectWorkspaceServices(projectPath, packageJson.workspaces);
      return { isMonorepo: true, services };
    }
    
    // Check for lerna
    try {
      const lernaPath = join(projectPath, 'lerna.json');
      await readFile(lernaPath, 'utf-8');
      const services = await detectLernaServices(projectPath);
      return { isMonorepo: true, services };
    } catch {
      // Not a lerna monorepo
    }
    
    // Check for nx
    if (packageJson.nx || await fileExists(join(projectPath, 'nx.json'))) {
      const services = await detectNxServices(projectPath);
      return { isMonorepo: true, services };
    }
  } catch {
    // Not a JS/TS project or no package.json
  }

  // Check for Cargo workspace (Rust)
  try {
    const cargoTomlPath = join(projectPath, 'Cargo.toml');
    const cargoToml = await readFile(cargoTomlPath, 'utf-8');
    if (cargoToml.includes('[workspace]')) {
      const services = await detectCargoWorkspaceMembers(projectPath, cargoToml);
      return { isMonorepo: true, services };
    }
  } catch {
    // Not a Rust project
  }

  return { isMonorepo: false, services: [] };
}

async function detectWorkspaceServices(projectPath: string, workspaces: string[] | { packages: string[] }): Promise<string[]> {
  const patterns = Array.isArray(workspaces) ? workspaces : workspaces.packages || [];
  const services: string[] = [];
  
  // This is a simplified version - in production you'd use glob patterns
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      // Handle glob patterns - simplified for now
      const baseDir = pattern.replace('/*', '').replace('/**', '');
      try {
        const { readdirSync } = await import('fs');
        const dirs = readdirSync(join(projectPath, baseDir), { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);
        services.push(...dirs);
      } catch {
        // Ignore errors
      }
    } else {
      services.push(basename(pattern));
    }
  }
  
  return services;
}

async function detectLernaServices(projectPath: string): Promise<string[]> {
  try {
    const { readdirSync } = await import('fs');
    const packages = readdirSync(join(projectPath, 'packages'), { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    return packages;
  } catch {
    return [];
  }
}

async function detectNxServices(projectPath: string): Promise<string[]> {
  // Simplified - in production you'd parse nx.json or workspace.json
  const services: string[] = [];
  
  for (const dir of ['apps', 'libs', 'packages']) {
    try {
      const { readdirSync } = await import('fs');
      const dirs = readdirSync(join(projectPath, dir), { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      services.push(...dirs);
    } catch {
      // Directory doesn't exist
    }
  }
  
  return services;
}

async function detectCargoWorkspaceMembers(_projectPath: string, cargoToml: string): Promise<string[]> {
  const match = cargoToml.match(/members\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return [];
  
  const membersString = match[1];
  if (!membersString) return [];
  
  const members = membersString
    .split(',')
    .map(m => m.trim().replace(/["']/g, ''))
    .filter(m => m);
    
  return members.map(m => basename(m));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const { access } = await import('fs/promises');
    await access(path);
    return true;
  } catch {
    return false;
  }
}