import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { Help } from './Help.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { SimilarFactsView } from './SimilarFactsView.js';
import { TruncatedText } from './TruncatedText.js';
import { AlternativeScreenView } from './AlternativeScreenView.js';
import { useTerminalDimensions } from '../hooks/useTerminalDimensions.js';
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
  const { columns, rows } = useTerminalDimensions();
  const [facts, setFacts] = useState<Array<Fact & { projectName: string; projectPath: string; isCurrentProject: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredFacts, setFilteredFacts] = useState<Array<Fact & { projectName: string; projectPath: string; isCurrentProject: boolean }>>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [similarFactsCounts, setSimilarFactsCounts] = useState<Map<string, number>>(new Map());
  const [loadingSimilarCounts, setLoadingSimilarCounts] = useState(false);
  const [showSimilarFacts, setShowSimilarFacts] = useState(false);

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
      } else if (input === 's' && filteredFacts.length > 0) {
        setShowSimilarFacts(true);
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

  // Load similar facts counts
  useEffect(() => {
    const loadSimilarCounts = async () => {
      if (facts.length === 0) return;
      
      setLoadingSimilarCounts(true);
      const counts = new Map<string, number>();
      
      // Load counts in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < facts.length && i < limit; i += batchSize) {
        const batch = facts.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (fact) => {
            try {
              const similar = await db.findSimilarFacts(fact.id, { 
                limit: 10, 
                threshold: 0.5 
              });
              counts.set(fact.id, similar.length);
            } catch (error) {
              counts.set(fact.id, 0);
            }
          })
        );
      }
      
      setSimilarFactsCounts(counts);
      setLoadingSimilarCounts(false);
    };

    loadSimilarCounts();
  }, [facts, db, limit]);

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

  // Calculate dimensions early so we can use them in items mapping
  const headerHeight = 3;
  const footerHeight = 2;
  const contentHeight = rows - headerHeight - footerHeight - 1; // -1 for padding
  
  // Split width: 60% for facts list, 40% for details on wide screens
  // On narrow screens, use 50/50 split
  const factsWidth = columns > 120 ? Math.floor(columns * 0.6) : Math.floor(columns * 0.5);
  const detailsWidth = columns - factsWidth - 3; // -3 for margins and borders

  const items = filteredFacts.map((fact, index) => {
    const typeStr = `[${fact.type.substring(0, 3).toUpperCase()}]`;
    const similarCount = similarFactsCounts.get(fact.id) || 0;
    
    // Use fixed-width formatting
    // • for current project (instead of star for predictable width)
    // Fixed width similarity count (3 chars + ≈)
    const projectMarker = fact.isCurrentProject ? '•' : ' ';
    const similarStr = similarCount > 0 ? `${similarCount.toString().padStart(3)}≈` : '    ';
    
    // Calculate available width for content
    // Account for: project marker (1), space (1), similar count (4), space (1), type (5), space (1)
    const prefixLength = 1 + 1 + 4 + 1 + 5 + 1;
    const availableWidth = factsWidth - prefixLength - 4; // -4 for padding/margins
    const contentMaxLength = Math.max(20, availableWidth); // minimum 20 chars
    
    const content = fact.content.length > contentMaxLength 
      ? fact.content.substring(0, contentMaxLength - 3) + '...' 
      : fact.content;
    
    return {
      label: `${projectMarker} ${similarStr} ${typeStr} ${content}`,
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
    return (
      <AlternativeScreenView>
        <Help context={initialQuery ? 'search' : 'list'} />
      </AlternativeScreenView>
    );
  }

  // Show confirmation dialog instead of normal view
  if (showDeleteConfirm && selectedFact) {
    return (
      <AlternativeScreenView>
        <Box flexDirection="column" height={20} justifyContent="center" alignItems="center">
          <ConfirmDialog
            message={`Delete fact: "${selectedFact.content.substring(0, 50)}${selectedFact.content.length > 50 ? '...' : ''}"?`}
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
            dangerous={true}
          />
        </Box>
      </AlternativeScreenView>
    );
  }

  // Show similar facts view
  if (showSimilarFacts && selectedFact) {
    return (
      <AlternativeScreenView>
        <SimilarFactsView 
          db={db} 
          fact={selectedFact} 
          onBack={() => setShowSimilarFacts(false)}
        />
      </AlternativeScreenView>
    );
  }

  // Full screen container
  return (
    <AlternativeScreenView>
      <Box flexDirection="column" height={rows - 1}>
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

      {/* Main content area - dynamic height */}
      <Box flexDirection="row" height={contentHeight} overflow="hidden">
        {/* Left pane - fact list */}
        <Box flexDirection="column" width={factsWidth} marginRight={2}>
          <Text bold dimColor>{initialQuery ? 'Results' : 'Facts'}</Text>
          <Box marginTop={1} width="100%">
            <SelectInput
              items={items}
              onSelect={handleSelect}
              onHighlight={handleSelect}
              initialIndex={0}
              limit={contentHeight - 2}
            />
          </Box>
        </Box>

        {/* Right pane - details */}
        <Box flexDirection="column" width={detailsWidth} overflow="hidden">
          <Text bold dimColor>Details</Text>
          {selectedFact && (
            <Box flexDirection="column" marginTop={1} height={contentHeight - 2} overflow="hidden">
              {/* Content section - flexible height */}
              <Box flexDirection="column" flexGrow={1} overflow="hidden">
                <TruncatedText 
                  text={selectedFact.content} 
                  maxLines={selectedFact.why ? Math.floor((contentHeight - 10) * 0.6) : contentHeight - 10} 
                  width={detailsWidth} 
                />
                {selectedFact.why && (
                  <Box marginTop={1} flexDirection="column">
                    <TruncatedText 
                      text={`Why: ${selectedFact.why}`} 
                      maxLines={Math.floor((contentHeight - 10) * 0.4)} 
                      width={detailsWidth} 
                      dimColor={true}
                    />
                  </Box>
                )}
              </Box>

              {/* Metadata section - fixed at bottom */}
              <Box flexDirection="column" flexShrink={0} marginTop={1}>
                <TruncatedText 
                  text={`Project: ${selectedFact.projectName}${selectedFact.isCurrentProject ? ' •' : ''}`}
                  maxLines={1}
                  width={detailsWidth}
                  dimColor={true}
                />
                <TruncatedText 
                  text={`Type: ${selectedFact.type} | Status: ${selectedFact.status}`}
                  maxLines={1}
                  width={detailsWidth}
                  dimColor={true}
                />
                <TruncatedText 
                  text={`Confidence: ${selectedFact.confidence}% | ${selectedFact.createdAt.toLocaleDateString()}`}
                  maxLines={1}
                  width={detailsWidth}
                  dimColor={true}
                />
                {selectedFact.tags.length > 0 && (
                  <TruncatedText 
                    text={`Tags: ${selectedFact.tags.join(', ')}`}
                    maxLines={1}
                    width={detailsWidth}
                    dimColor={true}
                  />
                )}
                {selectedFact.services.length > 0 && (
                  <TruncatedText 
                    text={`Services: ${selectedFact.services.join(', ')}`}
                    maxLines={1}
                    width={detailsWidth}
                    dimColor={true}
                  />
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer - fixed position */}
      <Box height={2} marginTop={1}>
        <Text dimColor>
          {isSearching 
            ? 'Type to filter | Enter: confirm | Esc: cancel' 
            : 'q: quit | ↑↓: navigate | /: filter | d: delete | s: similar | ?: help'}
        </Text>
      </Box>
    </Box>
    </AlternativeScreenView>
  );
}