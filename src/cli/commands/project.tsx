import React from 'react';
import { render, Box, Text } from 'ink';
import { Database } from '../../db/database.js';
import { getDbPath } from '../utils/db-config.js';
import { getProjectInfo } from '../utils/project.js';

interface ProjectInfoProps {
  projectPath: string;
}

interface ProjectStats {
  totalFacts: number;
  factsByType: Record<string, number>;
  lastFactDate?: Date;
}

function ProjectInfo({ projectPath }: ProjectInfoProps) {
  const [project, setProject] = React.useState<any>(null);
  const [stats, setStats] = React.useState<ProjectStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadProjectInfo() {
      try {
        const dbPath = getDbPath();
        const db = new Database(dbPath);
        
        const info = await getProjectInfo(projectPath);
        let dbProject = db.findProjectByPath(projectPath);
        
        if (!dbProject) {
          // Create project if it doesn't exist
          dbProject = db.createProject({
            name: info.name,
            path: info.path,
            gitRemote: info.gitRemote,
            isMonorepo: info.isMonorepo,
            services: info.services,
          });
        }
        
        // Get project statistics
        const facts = db.listFactsByProject(dbProject.id);
        const factsByType = facts.reduce((acc: Record<string, number>, fact) => {
          acc[fact.type] = (acc[fact.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        setProject({ ...info, ...dbProject });
        setStats({
          totalFacts: facts.length,
          factsByType,
          lastFactDate: facts[0]?.createdAt,
        });
        setLoading(false);
        
        db.close();
      } catch (error) {
        console.error('Error loading project info:', error);
        process.exit(1);
      }
    }
    
    loadProjectInfo();
  }, [projectPath]);

  if (loading) {
    return <Text>Loading project information...</Text>;
  }

  if (!project || !stats) {
    return <Text color="red">Error loading project information</Text>;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>Project Information</Text>
      <Box marginTop={1} />
      
      <Box flexDirection="column">
        <Text><Text bold>Name:</Text> {project.name}</Text>
        <Text><Text bold>Path:</Text> {project.path}</Text>
        {project.gitRemote && (
          <Text><Text bold>Git Remote:</Text> {project.gitRemote}</Text>
        )}
        <Text><Text bold>Type:</Text> {project.isMonorepo ? 'Monorepo' : 'Single Project'}</Text>
        {project.isMonorepo && project.services.length > 0 && (
          <Text><Text bold>Services:</Text> {project.services.join(', ')}</Text>
        )}
      </Box>

      <Box marginTop={1} />
      <Text bold underline>Statistics</Text>
      <Box marginTop={1} />
      
      <Box flexDirection="column">
        <Text><Text bold>Total Facts:</Text> {stats.totalFacts}</Text>
        {stats.lastFactDate && (
          <Text><Text bold>Last Fact:</Text> {new Date(stats.lastFactDate).toLocaleString()}</Text>
        )}
      </Box>

      {stats.factsByType && Object.keys(stats.factsByType).length > 0 && (
        <Box flexDirection="column">
          <Box marginTop={1} />
          <Text bold>Facts by Type:</Text>
          <Box flexDirection="column" marginLeft={2}>
            {Object.entries(stats.factsByType).map(([type, count]) => (
              <Text key={type}>
                {type}: {String(count)}
              </Text>
            ))}
          </Box>
        </Box>
      )}

      <Box marginTop={1} />
      <Text dimColor>Project ID: {project.id}</Text>
    </Box>
  );
}

export async function renderProjectInfo(): Promise<void> {
  const { waitUntilExit } = render(
    <ProjectInfo projectPath={process.cwd()} />
  );

  await waitUntilExit();
}