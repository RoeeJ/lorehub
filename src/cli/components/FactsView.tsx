import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { Help } from './Help.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import type { Database } from '../../db/database.js';
import type { Fact, FactType } from '../../core/types.js';

interface FactsViewProps {
  db: Database;
  projectPath: string;
  // Search-specific props
  initialQuery?: string;
  // Filter props
  type?: string;
  service?: string;
  limit?: number;
  filterProjectPath?: string;
  currentProjectOnly?: boolean;
}

export function FactsView({
  db,
  projectPath,
  initialQuery = '',
  type,
  service,
  limit = 100,
  filterProjectPath,
  currentProjectOnly,
}: FactsViewProps) {
  const { exit } = useApp();
  const [facts, setFacts] = useState<Array<Fact & { projectName: string; projectPath: string; isCurrentProject: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredFacts, setFilteredFacts] = useState<Array<Fact & { projectName: string; projectPath: string; isCurrentProject: boolean }>>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  useInput((input, key) => {
    if (showHelp) {
      if (input === '?' || key.escape) {
        setShowHelp(false);
      }
      return;
    }

    if (showDeleteConfirm) {
      // Let ConfirmDialog handle input
      return;
    }

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
      } else if (input === '?') {
        setShowHelp(true);
      } else if (input === 'd' && filteredFacts.length > 0) {
        setShowDeleteConfirm(true);
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
    
    // Get facts from selected projects
    for (const proj of projectsToSearch) {
      let projectFacts: Fact[] = [];
      
      if (initialQuery) {
        // Search mode
        projectFacts = db.searchFacts(proj.id, initialQuery);
      } else if (type) {
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

    // Apply additional filters
    if (initialQuery && type) {
      results = results.filter(f => f.type === type);
    }
    
    if (initialQuery && service) {
      results = results.filter(f => f.services.includes(service));
    }

    // Filter out archived facts unless specifically requested
    results = results.filter(f => f.status !== 'archived');

    // Sort by current project first, then by date
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
    setFilteredFacts(results);
    setLoading(false);
  }, [db, projectPath, initialQuery, type, service, limit, filterProjectPath, currentProjectOnly]);

  if (loading) {
    return <Text>Loading facts...</Text>;
  }

  if (facts.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">
          {initialQuery 
            ? `No facts found matching "${initialQuery}"`
            : 'No facts found'}
        </Text>
        {type && <Text dimColor>Filter: type = {type}</Text>}
        {service && <Text dimColor>Filter: service = {service}</Text>}
        {!initialQuery && (
          <Box marginTop={1}>
            <Text dimColor>Try adding facts with: lh add "Your fact here"</Text>
          </Box>
        )}
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

  const handleDelete = () => {
    const factToDelete = filteredFacts[selectedIndex];
    if (factToDelete) {
      db.softDeleteFact(factToDelete.id);
      // Remove from local state
      const newFacts = facts.filter(f => f.id !== factToDelete.id);
      const newFilteredFacts = filteredFacts.filter(f => f.id !== factToDelete.id);
      setFacts(newFacts);
      setFilteredFacts(newFilteredFacts);
      setShowDeleteConfirm(false);
      setDeleteSuccess(true);
      
      // Reset success message after 2 seconds
      setTimeout(() => setDeleteSuccess(false), 2000);
      
      // Adjust selected index if needed
      if (selectedIndex >= newFilteredFacts.length && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      }
    }
  };

  // Show help screen if requested
  if (showHelp) {
    return <Help context={initialQuery ? 'search' : 'list'} />;
  }

  // Show confirmation dialog instead of normal view
  if (showDeleteConfirm && selectedFact) {
    return (
      <Box flexDirection="column" height={20} justifyContent="center" alignItems="center">
        <ConfirmDialog
          message={`Delete fact: "${selectedFact.content.substring(0, 50)}${selectedFact.content.length > 50 ? '...' : ''}"?`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          dangerous={true}
        />
      </Box>
    );
  }

  // Fixed height container
  return (
    <Box flexDirection="column" height={20}>
      {/* Header - fixed height */}
      <Box height={3} flexDirection="column">
        <Text bold>
          {initialQuery
            ? `Found ${filteredFacts.length} fact${filteredFacts.length !== 1 ? 's' : ''} matching "${initialQuery}"`
            : `Found ${filteredFacts.length} fact${filteredFacts.length !== 1 ? 's' : ''}`}
          {searchTerm && ` (filtered: "${searchTerm}")`}
        </Text>
        {deleteSuccess && <Text color="green">✓ Fact deleted (archived)</Text>}
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
        {/* Left pane - fact list */}
        <Box flexDirection="column" width="50%" marginRight={2}>
          <Text bold dimColor>{initialQuery ? 'Results' : 'Facts'}</Text>
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
            : 'q: quit | ↑↓: navigate | /: filter | d: delete | ?: help'}
        </Text>
      </Box>
    </Box>
  );
}