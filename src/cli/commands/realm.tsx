import React from 'react';
import { render, Box, Text } from 'ink';
import { Database } from '../../db/database.js';
import { getDbPath } from '../utils/db-config.js';
import { getRealmInfo } from '../utils/realm.js';
import { EmbeddingService } from '../../core/embeddings.js';

interface RealmInfoProps {
  realmPath: string;
}

interface RealmStats {
  totalLores: number;
  loresByType: Record<string, number>;
  lastLoreDate?: Date;
  embeddingModel: string;
  embeddingDimensions: number;
}

function RealmInfo({ realmPath }: RealmInfoProps) {
  const [realm, setRealm] = React.useState<any>(null);
  const [stats, setStats] = React.useState<RealmStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadRealmInfo() {
      try {
        const dbPath = getDbPath();
        const db = new Database(dbPath);
        
        const info = await getRealmInfo(realmPath);
        let dbRealm = db.findRealmByPath(realmPath);
        
        if (!dbRealm) {
          // Create realm if it doesn't exist
          dbRealm = db.createRealm({
            name: info.name,
            path: info.path,
            gitRemote: info.gitRemote,
            isMonorepo: info.isMonorepo,
            provinces: info.provinces,
          });
        }
        
        // Get realm statistics
        const lores = db.listLoresByRealm(dbRealm.id);
        const loresByType = lores.reduce((acc: Record<string, number>, lore) => {
          acc[lore.type] = (acc[lore.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        // Get embedding info
        const embeddingService = EmbeddingService.getInstance();
        const modelConfig = embeddingService.getModelConfig();
        
        setRealm({ ...info, ...dbRealm });
        setStats({
          totalLores: lores.length,
          loresByType,
          lastLoreDate: lores[0]?.createdAt,
          embeddingModel: embeddingService.getCurrentModel(),
          embeddingDimensions: modelConfig.dimensions,
        });
        setLoading(false);
        
        db.close();
      } catch (error) {
        console.error('Error loading realm info:', error);
        process.exit(1);
      }
    }
    
    loadRealmInfo();
  }, [realmPath]);

  if (loading) {
    return <Text>Loading realm information...</Text>;
  }

  if (!realm || !stats) {
    return <Text color="red">Error loading realm information</Text>;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>Realm Information</Text>
      <Box marginTop={1} />
      
      <Box flexDirection="column">
        <Text><Text bold>Name:</Text> {realm.name}</Text>
        <Text><Text bold>Path:</Text> {realm.path}</Text>
        {realm.gitRemote && (
          <Text><Text bold>Git Remote:</Text> {realm.gitRemote}</Text>
        )}
        <Text><Text bold>Type:</Text> {realm.isMonorepo ? 'Monorepo' : 'Single Realm'}</Text>
        {realm.isMonorepo && realm.provinces.length > 0 && (
          <Text><Text bold>Provinces:</Text> {realm.provinces.join(', ')}</Text>
        )}
      </Box>

      <Box marginTop={1} />
      <Text bold underline>Statistics</Text>
      <Box marginTop={1} />
      
      <Box flexDirection="column">
        <Text><Text bold>Total Lores:</Text> {stats.totalLores}</Text>
        {stats.lastLoreDate && (
          <Text><Text bold>Last Lore:</Text> {new Date(stats.lastLoreDate).toLocaleString()}</Text>
        )}
      </Box>

      {stats.loresByType && Object.keys(stats.loresByType).length > 0 && (
        <Box flexDirection="column">
          <Box marginTop={1} />
          <Text bold>Lores by Type:</Text>
          <Box flexDirection="column" marginLeft={2}>
            {Object.entries(stats.loresByType).map(([type, count]) => (
              <Text key={type}>
                {type}: {String(count)}
              </Text>
            ))}
          </Box>
        </Box>
      )}

      <Box marginTop={1} />
      <Text bold underline>Embedding Configuration</Text>
      <Box marginTop={1} />
      
      <Box flexDirection="column">
        <Text><Text bold>Model:</Text> {stats.embeddingModel}</Text>
        <Text><Text bold>Dimensions:</Text> {stats.embeddingDimensions}</Text>
      </Box>

      <Box marginTop={1} />
      <Text dimColor>Realm ID: {realm.id}</Text>
    </Box>
  );
}

export async function renderRealmInfo(): Promise<void> {
  const { waitUntilExit } = render(
    <RealmInfo realmPath={process.cwd()} />
  );

  await waitUntilExit();
}