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

type FormField = 'content' | 'type' | 'why' | 'services' | 'tags' | 'confidence' | 'submit';

const factTypes: Array<{ label: string; value: FactType }> = [
  { label: 'Decision - Architectural or technical choice', value: 'decision' },
  { label: 'Learning - Something discovered', value: 'learning' },
  { label: 'Assumption - Unverified belief', value: 'assumption' },
  { label: 'Constraint - Limitation or requirement', value: 'constraint' },
  { label: 'Risk - Potential problem', value: 'risk' },
  { label: 'Todo - Future action needed', value: 'todo' },
  { label: 'Other - Miscellaneous', value: 'other' },
];

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
  
  // Form state
  const [currentField, setCurrentField] = useState<FormField>('content');
  const [content, setContent] = useState(initialContent);
  const [type, setType] = useState(initialType);
  const [why, setWhy] = useState(initialWhy);
  const [servicesText, setServicesText] = useState(initialServices.join(', '));
  const [tagsText, setTagsText] = useState(initialTags.join(', '));
  const [confidence, setConfidence] = useState(initialConfidence);

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
    if (!project || !content.trim()) {
      setError('Content is required');
      return;
    }

    try {
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

      await db.createFact(factInput);
      setSuccess(true);
      
      setTimeout(() => {
        onComplete?.(true);
        exit();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create fact');
    }
  };

  // Handle keyboard input
  useInput((_input, key) => {
    if (key.tab && !key.shift) {
      // Tab navigation (forward)
      const fields: FormField[] = ['content', 'type', 'why'];
      if (project?.isMonorepo) fields.push('services');
      fields.push('tags', 'confidence', 'submit');
      
      const currentIndex = fields.indexOf(currentField);
      const nextIndex = (currentIndex + 1) % fields.length;
      setCurrentField(fields[nextIndex] as FormField);
    } else if (key.tab && key.shift) {
      // Shift-Tab navigation (backward)
      const fields: FormField[] = ['content', 'type', 'why'];
      if (project?.isMonorepo) fields.push('services');
      fields.push('tags', 'confidence', 'submit');
      
      const currentIndex = fields.indexOf(currentField);
      const prevIndex = currentIndex === 0 ? fields.length - 1 : currentIndex - 1;
      setCurrentField(fields[prevIndex] as FormField);
    } else if (key.return) {
      if (currentField === 'submit' || (currentField === 'content' && content.trim())) {
        handleSubmit();
      }
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
    return <Text>Loading project information...</Text>;
  }

  if (error && !success) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (success) {
    return (
      <Box flexDirection="column">
        <Text color="green">✓ Fact created successfully!</Text>
        <Text dimColor>ID: {project?.id}</Text>
      </Box>
    );
  }

  // Render form
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>Add New Fact</Text>
      <Text dimColor>Project: {project?.name}</Text>
      <Box marginTop={1} />

      {/* Content */}
      <Box marginBottom={1}>
        <Text bold color={currentField === 'content' ? 'cyan' : undefined}>
          Content: {currentField === 'content' && <Text dimColor>(required)</Text>}
        </Text>
        {currentField === 'content' ? (
          <TextInput
            value={content}
            onChange={setContent}
            placeholder="e.g., Use Redis for session storage"
          />
        ) : (
          <Text>{content || <Text dimColor>No content</Text>}</Text>
        )}
      </Box>

      {/* Type */}
      <Box marginBottom={1}>
        <Text bold color={currentField === 'type' ? 'cyan' : undefined}>
          Type:
        </Text>
        {currentField === 'type' ? (
          <SelectInput
            items={factTypes}
            onSelect={(item) => setType(item.value)}
            initialIndex={factTypes.findIndex(t => t.value === type)}
          />
        ) : (
          <Text>{factTypes.find(t => t.value === type)?.label}</Text>
        )}
      </Box>

      {/* Why */}
      <Box marginBottom={1}>
        <Text bold color={currentField === 'why' ? 'cyan' : undefined}>
          Why: {currentField === 'why' && <Text dimColor>(optional)</Text>}
        </Text>
        {currentField === 'why' ? (
          <TextInput
            value={why}
            onChange={setWhy}
            placeholder="e.g., Need sub-50ms session lookups"
          />
        ) : (
          <Text>{why || <Text dimColor>No reason provided</Text>}</Text>
        )}
      </Box>

      {/* Services (for monorepos) */}
      {project?.isMonorepo && (
        <Box marginBottom={1}>
          <Text bold color={currentField === 'services' ? 'cyan' : undefined}>
            Services: {currentField === 'services' && <Text dimColor>(comma-separated)</Text>}
          </Text>
          {currentField === 'services' ? (
            <TextInput
              value={servicesText}
              onChange={setServicesText}
              placeholder={`e.g., ${project.services.slice(0, 3).join(', ')}`}
            />
          ) : (
            <Text>{servicesText || <Text dimColor>All services</Text>}</Text>
          )}
        </Box>
      )}

      {/* Tags */}
      <Box marginBottom={1}>
        <Text bold color={currentField === 'tags' ? 'cyan' : undefined}>
          Tags: {currentField === 'tags' && <Text dimColor>(comma-separated)</Text>}
        </Text>
        {currentField === 'tags' ? (
          <TextInput
            value={tagsText}
            onChange={setTagsText}
            placeholder="e.g., redis, performance, caching"
          />
        ) : (
          <Text>{tagsText || <Text dimColor>No tags</Text>}</Text>
        )}
      </Box>

      {/* Confidence */}
      <Box marginBottom={1}>
        <Text bold color={currentField === 'confidence' ? 'cyan' : undefined}>
          Confidence: {confidence}%
        </Text>
        {currentField === 'confidence' && (
          <Box>
            <Text dimColor>Use ← → to adjust (0-100)</Text>
          </Box>
        )}
      </Box>

      {/* Submit */}
      <Box marginTop={1}>
        {currentField === 'submit' ? (
          <Text bold color="green">
            Press Enter to create fact
          </Text>
        ) : (
          <Box flexDirection="column">
            <Text dimColor>Navigation:</Text>
            <Text dimColor>  Tab/Shift+Tab - Next/Previous | Enter - Submit | Esc - Cancel</Text>
            {currentField === 'confidence' && (
              <Text dimColor>  ← → - Adjust confidence</Text>
            )}
          </Box>
        )}
      </Box>

      {error && <Text color="red">Error: {error}</Text>}
    </Box>
  );
}