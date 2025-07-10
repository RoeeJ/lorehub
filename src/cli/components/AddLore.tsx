import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { AlternativeScreenView } from './AlternativeScreenView.js';
import { useTerminalDimensions } from '../hooks/useTerminalDimensions.js';
import type { Database } from '../../db/database.js';
import type { Realm, LoreType, CreateLoreInput } from '../../core/types.js';
import { getRealmInfo } from '../utils/realm.js';

interface AddLoreProps {
  db: Database;
  realmPath: string;
  initialContent?: string;
  initialType?: LoreType;
  initialWhy?: string;
  initialProvinces?: string[];
  initialSigils?: string[];
  initialConfidence?: number;
  onComplete?: (success: boolean) => void;
}

type FormField = 'content' | 'type' | 'why' | 'provinces' | 'sigils' | 'confidence';

const loreTypes: Array<{ label: string; value: LoreType }> = [
  { label: 'Decree', value: 'decree' },
  { label: 'Wisdom', value: 'wisdom' },
  { label: 'Belief', value: 'belief' },
  { label: 'Constraint', value: 'constraint' },
  { label: 'Requirement', value: 'requirement' },
  { label: 'Risk', value: 'risk' },
  { label: 'Quest', value: 'quest' },
  { label: 'Saga', value: 'saga' },
  { label: 'Story', value: 'story' },
  { label: 'Anomaly', value: 'anomaly' },
  { label: 'Other', value: 'other' },
];

const typeDescriptions: Record<LoreType, string> = {
  decree: 'Architectural or technical choice',
  wisdom: 'Something discovered or learned',
  belief: 'Unverified belief or hypothesis',
  constraint: 'Limitation or restriction',
  requirement: 'Business or technical requirement',
  risk: 'Potential problem or concern',
  quest: 'Future action needed',
  saga: 'Major initiative that will generate many lores',
  story: 'User story',
  anomaly: 'Bug or issue',
  other: 'Miscellaneous lore',
};

export function AddLore({
  db,
  realmPath,
  initialContent = '',
  initialType = 'decree',
  initialWhy = '',
  initialProvinces = [],
  initialSigils = [],
  initialConfidence = 80,
  onComplete,
}: AddLoreProps) {
  const { exit } = useApp();
  const { columns, rows } = useTerminalDimensions();
  const [realm, setRealm] = useState<Realm | null>(null);
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
  const [provincesText, setProvincesText] = useState(initialProvinces.join(', '));
  const [sigilsText, setSigilsText] = useState(initialSigils.join(', '));
  const [confidence, setConfidence] = useState(initialConfidence);
  const [duplicates, setDuplicates] = useState<Array<{ content: string; similarity: number }>>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // Load or create realm
  useEffect(() => {
    async function loadRealm() {
      try {
        const realmInfo = await getRealmInfo(realmPath);
        let existingRealm = db.findRealmByPath(realmPath);
        
        if (!existingRealm) {
          existingRealm = db.createRealm({
            name: realmInfo.name,
            path: realmInfo.path,
            gitRemote: realmInfo.gitRemote,
            isMonorepo: realmInfo.isMonorepo,
            provinces: realmInfo.provinces,
          });
        } else {
          db.updateRealmLastSeen(existingRealm.id);
        }
        
        setRealm(existingRealm);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load realm');
        setLoading(false);
      }
    }
    
    loadRealm();
  }, [db, realmPath]);

  const handleSubmit = async () => {
    if (isSubmitting || success) {
      return; // Prevent duplicate submissions
    }
    
    if (!realm || !content.trim()) {
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
          realm.id,
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
      
      const loreInput: CreateLoreInput = {
        realmId: realm.id,
        content: content.trim(),
        type,
        why: why.trim() || undefined,
        provinces: provincesText.split(',').map((s: string) => s.trim()).filter(Boolean),
        sigils: sigilsText.split(',').map((t: string) => t.trim()).filter(Boolean),
        confidence,
        origin: {
          type: 'manual',
          reference: 'cli',
          context: `Added via CLI in ${realm.name}`,
        },
      };

      const lore = await db.createLore(loreInput);
      setSuccess(true);
      
      setTimeout(() => {
        onComplete?.(true);
        exit();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lore');
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
                           currentField === 'provinces' || currentField === 'sigils';

    if (input === '?' && !isTextInputField) {
      setShowHelp(true);
    } else if (key.tab && !key.shift) {
      // Tab navigation (forward)
      const fields: FormField[] = ['content', 'type', 'why'];
      if (realm?.isMonorepo) fields.push('provinces');
      fields.push('sigils', 'confidence');
      
      const currentIndex = fields.indexOf(currentField);
      const nextIndex = (currentIndex + 1) % fields.length;
      setCurrentField(fields[nextIndex] as FormField);
    } else if (key.tab && key.shift) {
      // Shift-Tab navigation (backward)
      const fields: FormField[] = ['content', 'type', 'why'];
      if (realm?.isMonorepo) fields.push('provinces');
      fields.push('sigils', 'confidence');
      
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
      <AlternativeScreenView>
        <Box flexDirection="column" alignItems="center" justifyContent="center" height={rows - 1}>
          <Text>Loading realm information...</Text>
        </Box>
      </AlternativeScreenView>
    );
  }

  if (success) {
    return (
      <AlternativeScreenView>
        <Box flexDirection="column" alignItems="center" justifyContent="center" height={rows - 1}>
          <Text color="green" bold>✓ Lore created successfully!</Text>
          <Box marginTop={1}>
            <Text dimColor>Returning to shell...</Text>
          </Box>
        </Box>
      </AlternativeScreenView>
    );
  }

  if (showHelp) {
    return (
      <AlternativeScreenView>
        <Box flexDirection="column" height={rows - 1} padding={1}>
          <Text bold underline>Keyboard Shortcuts</Text>
          <Box marginTop={1} flexDirection="column">
            <Text><Text color="cyan">Tab</Text> - Next field</Text>
            <Text><Text color="cyan">Shift+Tab</Text> - Previous field</Text>
            <Text><Text color="cyan">Enter</Text> - Save lore</Text>
            <Text><Text color="cyan">Esc</Text> - Cancel</Text>
            <Text><Text color="cyan">←/→</Text> - Adjust confidence (when in confidence field)</Text>
            <Text><Text color="cyan">?</Text> - Toggle this help</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press ? or Esc to return</Text>
          </Box>
        </Box>
      </AlternativeScreenView>
    );
  }

  // Show duplicate warning if needed
  if (showDuplicateWarning && duplicates.length > 0) {
    return (
      <AlternativeScreenView>
        <Box flexDirection="column" height={rows - 1} padding={1}>
          <Text bold color="yellow">⚠ Potential Duplicate Lores Found</Text>
          <Box marginTop={1} flexDirection="column">
            <Text>The following existing lores are similar to your new lore:</Text>
            <Box marginTop={1} flexDirection="column">
              {duplicates.slice(0, 3).map((dup, i) => (
                <Box key={i} marginBottom={1}>
                  <Text>• [{Math.round(dup.similarity * 100)}% similar] {dup.content}</Text>
                </Box>
              ))}
            </Box>
          </Box>
          <Box marginTop={1}>
            <Text>Do you want to continue adding this lore anyway?</Text>
            <Text dimColor>Press Y to continue, N to cancel</Text>
          </Box>
        </Box>
      </AlternativeScreenView>
    );
  }

  // Main form - single column layout
  return (
    <AlternativeScreenView>
      <Box flexDirection="column" height={rows - 1}>
      {/* Header */}
      <Box height={3} flexDirection="column">
        <Text bold>Add New Lore</Text>
        <Text dimColor>{realm?.name} - {realm?.path}</Text>
        {error && <Text color="red">⚠ {error}</Text>}
      </Box>

      {/* Form fields */}
      <Box flexDirection="column" height={rows - 8} paddingX={1}>
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
                items={loreTypes.map(t => ({
                  ...t,
                  label: `${t.label} - ${typeDescriptions[t.value]}`,
                }))}
                onSelect={(item) => setType(item.value)}
                initialIndex={loreTypes.findIndex(t => t.value === type)}
                limit={8}
              />
            </Box>
          ) : (
            <Text>{loreTypes.find(t => t.value === type)?.label} - <Text dimColor>{typeDescriptions[type]}</Text></Text>
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

        {/* Provinces field (monorepo only) */}
        {realm?.isMonorepo && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color={currentField === 'provinces' ? 'cyan' : undefined}>
              Provinces <Text dimColor>(comma-separated)</Text>
            </Text>
            {currentField === 'provinces' ? (
              <TextInput
                value={provincesText}
                onChange={setProvincesText}
                placeholder={`e.g., ${realm.provinces.slice(0, 3).join(', ')}`}
              />
            ) : (
              <Text color={provincesText ? undefined : 'gray'}>{provincesText || 'All provinces'}</Text>
            )}
          </Box>
        )}

        {/* Sigils field */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={currentField === 'sigils' ? 'cyan' : undefined}>
            Sigils <Text dimColor>(comma-separated)</Text>
          </Text>
          {currentField === 'sigils' ? (
            <TextInput
              value={sigilsText}
              onChange={setSigilsText}
              placeholder="e.g., redis, cache, performance"
            />
          ) : (
            <Text color={sigilsText ? undefined : 'gray'}>{sigilsText || 'No sigils'}</Text>
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
    </AlternativeScreenView>
  );
}