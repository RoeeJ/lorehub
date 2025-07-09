import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
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
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredFacts, setFilteredFacts] = useState<Array<Fact & { projectName: string; projectPath: string; isCurrentProject: boolean }>>([]);

  useInput((input, key) => {
    if (isSearching) {
      if (key.escape) {
        setIsSearching(false);
        setSearchTerm('');
        setFilteredFacts(facts);
      } else if (key.return) {
        setIsSearching(false);
      } else if (key.backspace || key.delete) {
        const newSearchTerm = searchTerm.slice(0, -1);
        setSearchTerm(newSearchTerm);
        filterFacts(newSearchTerm);
      } else if (input && input.length === 1 && !key.ctrl && !key.meta) {
        const newSearchTerm = searchTerm + input;
        setSearchTerm(newSearchTerm);
        filterFacts(newSearchTerm);
      }
    } else {
      if (input === 'q' || key.escape) {
        exit();
      } else if (input === '/') {
        setIsSearching(true);
        setSearchTerm('');
      }
    }
  });

  const filterFacts = (term: string) => {
    if (!term) {
      setFilteredFacts(facts);
      return;
    }
    
    const lowerTerm = term.toLowerCase();
    const filtered = facts.filter(fact => 
      fact.content.toLowerCase().includes(lowerTerm) ||
      fact.type.toLowerCase().includes(lowerTerm) ||
      fact.tags.some(tag => tag.toLowerCase().includes(lowerTerm)) ||
      fact.projectName.toLowerCase().includes(lowerTerm)
    );
    
    setFilteredFacts(filtered);
    setSelectedIndex(0);
  };

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
    setFilteredFacts(results);
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

  const items = filteredFacts.map((fact, index) => {
    const typeStr = `[${fact.type.substring(0, 3).toUpperCase()}]`;
    const content = fact.content.length > 35 
      ? fact.content.substring(0, 35) + '...' 
      : fact.content.padEnd(35, ' ');
    
    return {
      label: `${fact.isCurrentProject ? '⭐' : ' '} ${typeStr} ${content}`,
      value: index,
    };
  });

  const selectedFact = filteredFacts[selectedIndex];

  // Handle selection changes
  const handleSelect = (item: { label: string; value: number }) => {
    setSelectedIndex(item.value);
  };

  // Fixed height container
  return (
    <Box flexDirection="column" height={20}>
      {/* Header - fixed height */}
      <Box height={3} flexDirection="column">
        <Text bold>
          Found {filteredFacts.length} fact{filteredFacts.length !== 1 ? 's' : ''} matching "{query}"
          {searchTerm && ` (filtered: "${searchTerm}")`}
        </Text>
        {(type || service) && (
          <Text dimColor>Filters: {[
            type && `type=${type}`,
            service && `service=${service}`
          ].filter(Boolean).join(', ')}</Text>
        )}
        {isSearching && (
          <Box>
            <Text color="cyan">/</Text>
            <TextInput value={searchTerm} onChange={() => {}} />
          </Box>
        )}
      </Box>

      {/* Main content area - fixed height */}
      <Box flexDirection="row" height={15}>
        {/* Left pane - results list */}
        <Box flexDirection="column" width="50%" marginRight={2}>
          <Text bold dimColor>Results</Text>
          <Box marginTop={1}>
            <SelectInput
              items={items}
              onSelect={handleSelect}
              onHighlight={handleSelect}
              initialIndex={0}
              limit={12}
            />
          </Box>
        </Box>

        {/* Right pane - details */}
        <Box flexDirection="column" width="50%">
          <Text bold dimColor>Details</Text>
          {selectedFact && (
            <Box flexDirection="column" marginTop={1}>
              {/* Content - always show */}
              <Box height={3}>
                <Text wrap="wrap">{selectedFact.content}</Text>
              </Box>
              
              {/* Why - fixed height block */}
              <Box height={2} marginTop={1}>
                <Text dimColor>Why: </Text>
                <Text color="cyan">{selectedFact.why || '-'}</Text>
              </Box>

              {/* Metadata - fixed layout */}
              <Box flexDirection="column" marginTop={1}>
                <Text dimColor>Project: {selectedFact.projectName}{selectedFact.isCurrentProject ? ' ⭐' : ''}</Text>
                <Text dimColor>Type: {selectedFact.type} | Status: {selectedFact.status}</Text>
                <Text dimColor>Confidence: {selectedFact.confidence}% | {selectedFact.createdAt.toLocaleDateString()}</Text>
              </Box>

              {/* Tags - fixed height */}
              <Box height={1} marginTop={1}>
                <Text dimColor>Tags: {selectedFact.tags.length > 0 ? selectedFact.tags.join(', ') : '-'}</Text>
              </Box>

              {/* Services - fixed height */}
              {selectedFact.services.length > 0 && (
                <Box height={1}>
                  <Text dimColor>Services: {selectedFact.services.join(', ')}</Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer - fixed position */}
      <Box height={2} marginTop={1}>
        <Text dimColor>
          {isSearching 
            ? 'Type to filter | Enter: confirm | Esc: cancel' 
            : 'q: quit | ↑↓: navigate | /: filter results'}
        </Text>
      </Box>
    </Box>
  );
}