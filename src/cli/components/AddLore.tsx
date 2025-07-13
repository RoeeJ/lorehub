import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
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
  const [confidence, setConfidence] = useState(initialConfidence || 90); // Default to 90%
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
      
      // Exit immediately after successful creation
      onComplete?.(true);
      process.exit(0);
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
      // Tab navigation (forward) - simplified for essential fields only
      const fields: FormField[] = content ? ['content', 'type', 'confidence'] : ['content'];
      
      const currentIndex = fields.indexOf(currentField);
      const nextIndex = (currentIndex + 1) % fields.length;
      setCurrentField(fields[nextIndex] as FormField);
    } else if (key.tab && key.shift) {
      // Shift-Tab navigation (backward) - simplified for essential fields only
      const fields: FormField[] = content ? ['content', 'type', 'confidence'] : ['content'];
      
      const currentIndex = fields.indexOf(currentField);
      const prevIndex = currentIndex === 0 ? fields.length - 1 : currentIndex - 1;
      setCurrentField(fields[prevIndex] as FormField);
    } else if (key.return && !key.shift) {
      handleSubmit();
    } else if (key.escape) {
      onComplete?.(false);
      process.exit(0);
    } else if (currentField === 'confidence') {
      if (key.leftArrow && confidence > 0) {
        setConfidence(Math.max(0, confidence - 5));
      } else if (key.rightArrow && confidence < 100) {
        setConfidence(Math.min(100, confidence + 5));
      }
    }
  });

  // Remove the success screen - we exit immediately after creation

  if (!loading && showHelp) {
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
  if (!loading && showDuplicateWarning && duplicates.length > 0) {
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

  // Main form - conversational style
  return (
    <AlternativeScreenView>
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        {/* Show error if realm failed to load */}
        {error && !realm && (
          <Box marginBottom={1}>
            <Text color="red">⚠ {error}</Text>
          </Box>
        )}
        
        {/* Content prompt - always show */}
        <Box flexDirection="column">
          <Text color={currentField === 'content' ? 'cyan' : undefined}>📝 What lore do you wish to record?</Text>
          <Box marginTop={1} flexDirection="row">
            <Text color="gray">&gt; </Text>
            {currentField === 'content' ? (
              <TextInput
                value={content}
                onChange={setContent}
                placeholder=""
                focus={true}
              />
            ) : (
              <Text>{content}</Text>
            )}
          </Box>
        </Box>

        {/* Show other fields after content is entered */}
        {content && (
          <>
            {/* Type field */}
            <Box flexDirection="column" marginTop={1}>
              <Text color={currentField === 'type' ? 'cyan' : undefined}>
                📂 Type: {loreTypes.find(t => t.value === type)?.label?.toLowerCase()}
              </Text>
              {currentField === 'type' && (
                <Box marginTop={1} marginLeft={2}>
                  <SelectInput
                    items={loreTypes.map(t => ({
                      ...t,
                      label: t.label.toLowerCase(),
                    }))}
                    onSelect={(item) => setType(item.value)}
                    initialIndex={loreTypes.findIndex(t => t.value === type)}
                    limit={8}
                  />
                </Box>
              )}
            </Box>

            {/* Confidence field */}
            <Box flexDirection="column" marginTop={1}>
              <Text color={currentField === 'confidence' ? 'cyan' : undefined}>✨ Confidence: {confidence}%</Text>
              {currentField === 'confidence' && (
                <Box marginTop={1}>
                  <Text dimColor>Use ← → arrows to adjust</Text>
                </Box>
              )}
            </Box>
          </>
        )}

        {/* Success message */}
        {isSubmitting && (
          <Box marginTop={2}>
            <Text color="green">✓ Lore recorded successfully!</Text>
          </Box>
        )}

        {/* Error message */}
        {error && (
          <Box marginTop={1}>
            <Text color="red">⚠ {error}</Text>
          </Box>
        )}

        {/* Help text */}
        <Box marginTop={2}>
          <Text dimColor>
            {currentField === 'content' ? 'Press Enter to continue' : 
             currentField === 'confidence' ? 'Press Enter to save, Tab to continue' :
             'Press Tab to continue, Enter to save'}
          </Text>
        </Box>
      </Box>
    </AlternativeScreenView>
  );
}