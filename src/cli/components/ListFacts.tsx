import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type { Database } from '../../db/database.js';
import type { Fact, FactType } from '../../core/types.js';

interface ListFactsProps {
  db: Database;
  projectPath: string;
  type?: string;
  service?: string;
  limit: number;
  filterProjectPath?: string;
  currentProjectOnly?: boolean;
}

export function ListFacts({
  db,
  projectPath,
  type,
  service,
  limit,
  filterProjectPath,
  currentProjectOnly,
}: ListFactsProps) {
  const { exit } = useApp();
  const [facts, setFacts] = useState<Array<Fact & { projectName: string; projectPath: string; isCurrentProject: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      exit();
    }
  });

  useEffect(() => {
    const currentProject = db.findProjectByPath(projectPath);
    const projects = db.listProjects();
    
    // Filter projects based on options
    let projectsToList = projects;
    
    if (currentProjectOnly) {
      if (!currentProject) {
        setFacts([]);
        setLoading(false);
        return;
      }
      projectsToList = [currentProject];
    } else if (filterProjectPath) {
      const specificProject = db.findProjectByPath(filterProjectPath);
      if (!specificProject) {
        setFacts([]);
        setLoading(false);
        return;
      }
      projectsToList = [specificProject];
    }

    let results: Array<Fact & { projectName: string; projectPath: string; isCurrentProject: boolean }> = [];
    
    // List facts from selected projects
    for (const proj of projectsToList) {
      let projectFacts: Fact[] = [];
      
      if (type) {
        projectFacts = db.listFactsByType(proj.id, type as FactType);
      } else if (service) {
        projectFacts = db.listFactsByService(proj.id, service);
      } else {
        projectFacts = db.listFactsByProject(proj.id);
      }
      
      // Add project info to each fact
      results.push(...projectFacts.map(f => ({
        ...f,
        projectName: proj.name,
        projectPath: proj.path,
        isCurrentProject: currentProject?.id === proj.id
      })));
    }

    // Sort by current project first, then by creation date descending
    results.sort((a, b) => {
      // Prioritize current project
      if (a.isCurrentProject && !b.isCurrentProject) return -1;
      if (!a.isCurrentProject && b.isCurrentProject) return 1;
      // Then by date
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    
    // Apply limit
    if (results.length > limit) {
      results = results.slice(0, limit);
    }
    
    setFacts(results);
    setLoading(false);
  }, [db, projectPath, type, service, limit, filterProjectPath, currentProjectOnly]);

  if (loading) {
    return <Text>Loading facts...</Text>;
  }

  if (facts.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No facts found</Text>
        {type && <Text dimColor>Filter: type = {type}</Text>}
        {service && <Text dimColor>Filter: service = {service}</Text>}
        <Box marginTop={1}>
          <Text dimColor>Try adding facts with: lh add "Your fact here"</Text>
        </Box>
      </Box>
    );
  }

  const items = facts.map((fact, index) => ({
    label: `${fact.isCurrentProject ? '⭐ ' : ''}[${fact.type.substring(0, 3)}] ${fact.content.substring(0, 40)}${fact.content.length > 40 ? '...' : ''}`,
    value: index,
  }));

  const selectedFact = facts[selectedIndex];

  // Handle selection changes
  const handleSelect = (item: { label: string; value: number }) => {
    setSelectedIndex(item.value);
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Header - fixed position */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Facts ({facts.length})</Text>
        {(type || service) && (
          <Text dimColor>
            Filters: {[
              type && `type=${type}`,
              service && `service=${service}`
            ].filter(Boolean).join(', ')}
          </Text>
        )}
      </Box>

      {/* Main content area */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left pane - fact list */}
        <Box flexDirection="column" width={45} marginRight={2}>
          <SelectInput
            items={items}
            onSelect={handleSelect}
            onHighlight={handleSelect}
            initialIndex={0}
            limit={10}
          />
        </Box>

        {/* Right pane - details */}
        {selectedFact && (
          <Box flexDirection="column" flexGrow={1}>
            <Text bold>Details</Text>
            <Text>{' '}</Text>
            <Text>{selectedFact.content}</Text>
            
            {selectedFact.why && (
              <>
                <Text>{' '}</Text>
                <Text color="cyan">Why: {selectedFact.why}</Text>
              </>
            )}

            <Text>{' '}</Text>
            <Text dimColor>Project: {selectedFact.projectName}{selectedFact.isCurrentProject ? ' ⭐' : ''}</Text>
            <Text dimColor>Type: {selectedFact.type} | Status: {selectedFact.status}</Text>
            <Text dimColor>Confidence: {selectedFact.confidence}% | {selectedFact.createdAt.toLocaleDateString()}</Text>
            {selectedFact.tags.length > 0 && (
              <Text dimColor>Tags: {selectedFact.tags.join(', ')}</Text>
            )}
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>q: quit | ↑↓: navigate</Text>
      </Box>
    </Box>
  );
}