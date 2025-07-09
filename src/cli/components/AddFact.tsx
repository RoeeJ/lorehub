import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import type { Database } from '../../db/database.js';
import type { Project, FactType, CreateFactInput } from '../../core/types.js';
import { getProjectInfo } from '../utils/project.js';

interface AddFactProps {
  db: Database;
  projectPath: string;
  initialContent?: string;
  initialType?: FactType;
  initialWhy?: string;
  initialServices?: string[];
  initialTags?: string[];
  initialConfidence?: number;
  onComplete?: (success: boolean) => void;
}

type FormField = 'content' | 'type' | 'why' | 'services' | 'tags' | 'confidence';

const factTypes: Array<{ label: string; value: FactType }> = [
  { label: 'Decision', value: 'decision' },
  { label: 'Learning', value: 'learning' },
  { label: 'Assumption', value: 'assumption' },
  { label: 'Constraint', value: 'constraint' },
  { label: 'Requirement', value: 'requirement' },
  { label: 'Risk', value: 'risk' },
  { label: 'Todo', value: 'todo' },
  { label: 'Other', value: 'other' },
];

const typeDescriptions: Record<FactType, string> = {
  decision: 'Architectural or technical choice',
  learning: 'Something discovered or learned',
  assumption: 'Unverified belief or hypothesis',
  constraint: 'Limitation or requirement',
  requirement: 'Business or technical requirement',
  risk: 'Potential problem or concern',
  todo: 'Future action needed',
  other: 'Miscellaneous fact',
};

export function AddFact({
  db,
  projectPath,
  initialContent = '',
  initialType = 'decision',
  initialWhy = '',
  initialServices = [],
  initialTags = [],
  initialConfidence = 80,
  onComplete,
}: AddFactProps) {
  const { exit } = useApp();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [currentField, setCurrentField] = useState<FormField>('content');
  const [content, setContent] = useState(initialContent);
  const [type, setType] = useState(initialType);
  const [why, setWhy] = useState(initialWhy);
  const [servicesText, setServicesText] = useState(initialServices.join(', '));
  const [tagsText, setTagsText] = useState(initialTags.join(', '));
  const [confidence, setConfidence] = useState(initialConfidence);
  const [duplicates, setDuplicates] = useState<Array<{ content: string; similarity: number }>>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // Load or create project
  useEffect(() => {
    async function loadProject() {
      try {
        const projectInfo = await getProjectInfo(projectPath);
        let existingProject = db.findProjectByPath(projectPath);
        
        if (!existingProject) {
          existingProject = db.createProject({
            name: projectInfo.name,
            path: projectInfo.path,
            gitRemote: projectInfo.gitRemote,
            isMonorepo: projectInfo.isMonorepo,
            services: projectInfo.services,
          });
        } else {
          db.updateProjectLastSeen(existingProject.id);
        }
        
        setProject(existingProject);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
        setLoading(false);
      }
    }
    
    loadProject();
  }, [db, projectPath]);

  const handleSubmit = async () => {
    if (isSubmitting || success) {
      return; // Prevent duplicate submissions
    }
    
    if (!project || !content.trim()) {
      setError('Content is required');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Check for duplicates before creating
      if (!showDuplicateWarning) {
        const potentialDuplicates = await db.checkForDuplicates(
          content.trim(),
          project.id,
          0.85 // 85% similarity threshold
        );
        
        if (potentialDuplicates.length > 0) {
          setDuplicates(potentialDuplicates.map(d => ({
            content: d.content,
            similarity: d.similarity
          })));
          setShowDuplicateWarning(true);
          setIsSubmitting(false);
          return;
        }
      }
      
      const factInput: CreateFactInput = {
        projectId: project.id,
        content: content.trim(),
        type,
        why: why.trim() || undefined,
        services: servicesText.split(',').map(s => s.trim()).filter(Boolean),
        tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
        confidence,
        source: {
          type: 'manual',
          reference: 'cli',
          context: `Added via CLI in ${project.name}`,
        },
      };

      const fact = await db.createFact(factInput);
      setSuccess(true);
      
      setTimeout(() => {
        onComplete?.(true);
        exit();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create fact');
      setTimeout(() => setError(null), 3000);
      setIsSubmitting(false);
    }
  };

  // Handle keyboard input
  useInput((input, key) => {
    // Ignore all input during submission or after success
    if (isSubmitting || success) {
      return;
    }
    
    // Handle duplicate warning response
    if (showDuplicateWarning) {
      if (input.toLowerCase() === 'y') {
        setShowDuplicateWarning(false);
        handleSubmit(); // Continue with submission
      } else if (input.toLowerCase() === 'n' || key.escape) {
        setShowDuplicateWarning(false);
        setDuplicates([]);
      }
      return;
    }
    
    if (showHelp) {
      if (input === '?' || key.escape) {
        setShowHelp(false);
      }
      return;
    }

    // Check if we're in a text input field
    const isTextInputField = currentField === 'content' || currentField === 'why' || 
                           currentField === 'services' || currentField === 'tags';

    if (input === '?' && !isTextInputField) {
      setShowHelp(true);
    } else if (key.tab && !key.shift) {
      // Tab navigation (forward)
      const fields: FormField[] = ['content', 'type', 'why'];
      if (project?.isMonorepo) fields.push('services');
      fields.push('tags', 'confidence');
      
      const currentIndex = fields.indexOf(currentField);
      const nextIndex = (currentIndex + 1) % fields.length;
      setCurrentField(fields[nextIndex] as FormField);
    } else if (key.tab && key.shift) {
      // Shift-Tab navigation (backward)
      const fields: FormField[] = ['content', 'type', 'why'];
      if (project?.isMonorepo) fields.push('services');
      fields.push('tags', 'confidence');
      
      const currentIndex = fields.indexOf(currentField);
      const prevIndex = currentIndex === 0 ? fields.length - 1 : currentIndex - 1;
      setCurrentField(fields[prevIndex] as FormField);
    } else if (key.return && !key.shift) {
      handleSubmit();
    } else if (key.escape) {
      onComplete?.(false);
      exit();
    } else if (currentField === 'confidence') {
      if (key.leftArrow && confidence > 0) {
        setConfidence(Math.max(0, confidence - 5));
      } else if (key.rightArrow && confidence < 100) {
        setConfidence(Math.min(100, confidence + 5));
      }
    }
  });

  // Handle loading and error states
  if (loading) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={20}>
        <Text>Loading project information...</Text>
      </Box>
    );
  }

  if (success) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={20}>
        <Text color="green" bold>✓ Fact created successfully!</Text>
        <Box marginTop={1}>
          <Text dimColor>Returning to shell...</Text>
        </Box>
      </Box>
    );
  }

  if (showHelp) {
    return (
      <Box flexDirection="column" height={20} padding={1}>
        <Text bold underline>Keyboard Shortcuts</Text>
        <Box marginTop={1} flexDirection="column">
          <Text><Text color="cyan">Tab</Text> - Next field</Text>
          <Text><Text color="cyan">Shift+Tab</Text> - Previous field</Text>
          <Text><Text color="cyan">Enter</Text> - Save fact</Text>
          <Text><Text color="cyan">Esc</Text> - Cancel</Text>
          <Text><Text color="cyan">←/→</Text> - Adjust confidence (when in confidence field)</Text>
          <Text><Text color="cyan">?</Text> - Toggle this help</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press ? or Esc to return</Text>
        </Box>
      </Box>
    );
  }

  // Show duplicate warning if needed
  if (showDuplicateWarning && duplicates.length > 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="yellow">⚠ Potential Duplicate Facts Found</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>The following existing facts are similar to your new fact:</Text>
          <Box marginTop={1} flexDirection="column">
            {duplicates.slice(0, 3).map((dup, i) => (
              <Box key={i} marginBottom={1}>
                <Text>• [{Math.round(dup.similarity * 100)}% similar] {dup.content}</Text>
              </Box>
            ))}
          </Box>
        </Box>
        <Box marginTop={1}>
          <Text>Do you want to continue adding this fact anyway?</Text>
          <Text dimColor>Press Y to continue, N to cancel</Text>
        </Box>
      </Box>
    );
  }

  // Main form - single column layout
  return (
    <Box flexDirection="column" height={20}>
      {/* Header */}
      <Box height={3} flexDirection="column">
        <Text bold>Add New Fact</Text>
        <Text dimColor>{project?.name} - {project?.path}</Text>
        {error && <Text color="red">⚠ {error}</Text>}
      </Box>

      {/* Form fields */}
      <Box flexDirection="column" height={15} paddingX={1}>
        {/* Content field */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={currentField === 'content' ? 'cyan' : undefined}>
            Content {!content && <Text dimColor>(required)</Text>}
          </Text>
          {currentField === 'content' ? (
            <TextInput
              value={content}
              onChange={setContent}
              placeholder="e.g., Use Redis for session storage"
            />
          ) : (
            <Text color={content ? undefined : 'gray'}>{content || 'No content yet'}</Text>
          )}
        </Box>

        {/* Type field */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={currentField === 'type' ? 'cyan' : undefined}>Type</Text>
          {currentField === 'type' ? (
            <Box height={8}>
              <SelectInput
                items={factTypes.map(t => ({
                  ...t,
                  label: `${t.label} - ${typeDescriptions[t.value]}`,
                }))}
                onSelect={(item) => setType(item.value)}
                initialIndex={factTypes.findIndex(t => t.value === type)}
                limit={8}
              />
            </Box>
          ) : (
            <Text>{factTypes.find(t => t.value === type)?.label} - <Text dimColor>{typeDescriptions[type]}</Text></Text>
          )}
        </Box>

        {/* Why field */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={currentField === 'why' ? 'cyan' : undefined}>
            Why <Text dimColor>(optional)</Text>
          </Text>
          {currentField === 'why' ? (
            <TextInput
              value={why}
              onChange={setWhy}
              placeholder="e.g., Need sub-50ms session lookups"
            />
          ) : (
            <Text color={why ? undefined : 'gray'}>{why || 'No reason provided'}</Text>
          )}
        </Box>

        {/* Services field (monorepo only) */}
        {project?.isMonorepo && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color={currentField === 'services' ? 'cyan' : undefined}>
              Services <Text dimColor>(comma-separated)</Text>
            </Text>
            {currentField === 'services' ? (
              <TextInput
                value={servicesText}
                onChange={setServicesText}
                placeholder={`e.g., ${project.services.slice(0, 3).join(', ')}`}
              />
            ) : (
              <Text color={servicesText ? undefined : 'gray'}>{servicesText || 'All services'}</Text>
            )}
          </Box>
        )}

        {/* Tags field */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={currentField === 'tags' ? 'cyan' : undefined}>
            Tags <Text dimColor>(comma-separated)</Text>
          </Text>
          {currentField === 'tags' ? (
            <TextInput
              value={tagsText}
              onChange={setTagsText}
              placeholder="e.g., redis, cache, performance"
            />
          ) : (
            <Text color={tagsText ? undefined : 'gray'}>{tagsText || 'No tags'}</Text>
          )}
        </Box>

        {/* Confidence field */}
        <Box flexDirection="column">
          <Text bold color={currentField === 'confidence' ? 'cyan' : undefined}>
            Confidence: {confidence}%
          </Text>
          <Box>
            <Text>{'[' + '█'.repeat(Math.floor(confidence / 5)) + '░'.repeat(20 - Math.floor(confidence / 5)) + ']'}</Text>
          </Box>
          {currentField === 'confidence' && (
            <Text dimColor>Use ← → to adjust</Text>
          )}
        </Box>
      </Box>

      {/* Footer */}
      <Box height={2}>
        <Text dimColor>
          Tab: next | Shift+Tab: previous | Enter: save | Esc: cancel | ?: help
        </Text>
      </Box>
    </Box>
  );
}