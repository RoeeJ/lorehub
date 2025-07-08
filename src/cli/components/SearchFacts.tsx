import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type { Database } from '../../db/database.js';
import type { Fact, Project } from '../../core/types.js';

interface SearchFactsProps {
  db: Database;
  projectPath: string;
  query: string;
  type?: string;
  service?: string;
  filterProjectPath?: string;
  currentProjectOnly?: boolean;
}

export function SearchFacts({
  db,
  projectPath,
  query,
  type,
  service,
  filterProjectPath,
  currentProjectOnly,
}: SearchFactsProps) {
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
    let projectsToSearch = projects;
    
    if (currentProjectOnly) {
      if (!currentProject) {
        setFacts([]);
        setLoading(false);
        return;
      }
      projectsToSearch = [currentProject];
    } else if (filterProjectPath) {
      const specificProject = db.findProjectByPath(filterProjectPath);
      if (!specificProject) {
        setFacts([]);
        setLoading(false);
        return;
      }
      projectsToSearch = [specificProject];
    }

    let results: Array<Fact & { projectName: string; projectPath: string; isCurrentProject: boolean }> = [];
    
    // Search selected projects
    for (const proj of projectsToSearch) {
      const projectFacts = db.searchFacts(proj.id, query);
      // Add project info to each fact
      results.push(...projectFacts.map(f => ({
        ...f,
        projectName: proj.name,
        projectPath: proj.path,
        isCurrentProject: currentProject?.id === proj.id
      })));
    }

    // Apply filters
    if (type) {
      results = results.filter(f => f.type === type);
    }
    
    if (service) {
      results = results.filter(f => f.services.includes(service));
    }

    // Sort by current project first, then by date
    results.sort((a, b) => {
      // Prioritize current project
      if (a.isCurrentProject && !b.isCurrentProject) return -1;
      if (!a.isCurrentProject && b.isCurrentProject) return 1;
      // Then by date
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    
    setFacts(results);
    setLoading(false);
  }, [db, projectPath, query, type, service, filterProjectPath, currentProjectOnly]);

  if (loading) {
    return <Text>Searching...</Text>;
  }

  if (facts.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No facts found matching "{query}"</Text>
        {type && <Text dimColor>Filter: type = {type}</Text>}
        {service && <Text dimColor>Filter: service = {service}</Text>}
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
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>Found {facts.length} fact{facts.length === 1 ? '' : 's'} matching "{query}"</Text>
      </Box>

      {/* Main content area */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left pane - results list */}
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
            <Text dimColor>Type: {selectedFact.type} | Confidence: {selectedFact.confidence}%</Text>
            <Text dimColor>Created: {selectedFact.createdAt.toLocaleDateString()}</Text>
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