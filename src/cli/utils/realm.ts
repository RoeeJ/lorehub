import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import { execSync } from 'child_process';

export interface RealmInfo {
  name: string;
  path: string;
  gitRemote?: string;
  isMonorepo: boolean;
  provinces: string[];
}

export async function getRealmInfo(realmPath: string): Promise<RealmInfo> {
  const name = await detectProjectName(realmPath);
  const gitRemote = detectGitRemote(realmPath);
  const { isMonorepo, provinces } = await detectMonorepoInfo(realmPath);

  return {
    name,
    path: realmPath,
    gitRemote,
    isMonorepo,
    provinces,
  };
}

async function detectProjectName(realmPath: string): Promise<string> {
  // Try package.json first
  try {
    const packageJsonPath = join(realmPath, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    if (packageJson.name) {
      return packageJson.name;
    }
  } catch {
    // Ignore error, try other methods
  }

  // Try Cargo.toml for Rust realms
  try {
    const cargoTomlPath = join(realmPath, 'Cargo.toml');
    const cargoToml = await readFile(cargoTomlPath, 'utf-8');
    const match = cargoToml.match(/name\s*=\s*"([^"]+)"/);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    // Ignore error
  }

  // Default to directory name
  return basename(realmPath);
}

function detectGitRemote(realmPath: string): string | undefined {
  try {
    const remote = execSync('git remote get-url origin', {
      cwd: realmPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    
    return remote || undefined;
  } catch {
    return undefined;
  }
}

async function detectMonorepoInfo(realmPath: string): Promise<{ isMonorepo: boolean; provinces: string[] }> {
  // Check for common monorepo indicators
  try {
    const packageJsonPath = join(realmPath, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    
    // Check for workspace configuration (npm/yarn/pnpm)
    if (packageJson.workspaces) {
      const provinces = await detectWorkspaceProvinces(realmPath, packageJson.workspaces);
      return { isMonorepo: true, provinces };
    }
    
    // Check for lerna
    try {
      const lernaPath = join(realmPath, 'lerna.json');
      await readFile(lernaPath, 'utf-8');
      const provinces = await detectLernaServices(realmPath);
      return { isMonorepo: true, provinces };
    } catch {
      // Not a lerna monorepo
    }
    
    // Check for nx
    if (packageJson.nx || await fileExists(join(realmPath, 'nx.json'))) {
      const provinces = await detectNxServices(realmPath);
      return { isMonorepo: true, provinces };
    }
  } catch {
    // Not a JS/TS realm or no package.json
  }

  // Check for Cargo workspace (Rust)
  try {
    const cargoTomlPath = join(realmPath, 'Cargo.toml');
    const cargoToml = await readFile(cargoTomlPath, 'utf-8');
    if (cargoToml.includes('[workspace]')) {
      const provinces = await detectCargoWorkspaceMembers(realmPath, cargoToml);
      return { isMonorepo: true, provinces };
    }
  } catch {
    // Not a Rust realm
  }

  return { isMonorepo: false, provinces: [] };
}

async function detectWorkspaceProvinces(realmPath: string, workspaces: string[] | { packages: string[] }): Promise<string[]> {
  const patterns = Array.isArray(workspaces) ? workspaces : workspaces.packages || [];
  const services: string[] = [];
  
  // This is a simplified version - in production you'd use glob patterns
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      // Handle glob patterns - simplified for now
      const baseDir = pattern.replace('/*', '').replace('/**', '');
      try {
        const { readdirSync } = await import('fs');
        const dirs = readdirSync(join(realmPath, baseDir), { withFileTypes: true })
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

async function detectLernaServices(realmPath: string): Promise<string[]> {
  try {
    const { readdirSync } = await import('fs');
    const packages = readdirSync(join(realmPath, 'packages'), { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    return packages;
  } catch {
    return [];
  }
}

async function detectNxServices(realmPath: string): Promise<string[]> {
  // Simplified - in production you'd parse nx.json or workspace.json
  const services: string[] = [];
  
  for (const dir of ['apps', 'libs', 'packages']) {
    try {
      const { readdirSync } = await import('fs');
      const dirs = readdirSync(join(realmPath, dir), { withFileTypes: true })
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