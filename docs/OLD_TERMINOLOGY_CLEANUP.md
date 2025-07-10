# Old Terminology Cleanup Report

## Summary
This report identified all remaining references to old terminology (fact/facts, project/projects, service/services) that were updated to the new terminology (lore/lores, realm/realms, province/provinces) in v0.2.1.

## Files That Were Updated

### 1. `/src/cli/cli.ts`
**Lines that had "fact" references (now updated to "lore"):**
- Line 125: `const facts = db.listLoresByRealm(project.id);`
- Line 126: `console.log(\`\\nLores: ${facts.length}\`);`
- Line 128-129: `const factsByType = facts.reduce((acc, fact) => {`
- Line 133: `Object.entries(factsByType).forEach(([type, count]) => {`
- Line 197: `.command('similar <factId>')`
- Line 201: `.action(async (factId: string, options) => {`
- Line 206: `const fact = db.findLore(factId);`
- Line 207-208: `if (!fact) { console.error(\`Fact with ID ${factId} not found\`);`
- Line 212: `console.log(\`\\nFinding lores similar to:\\n[${fact.type}] ${fact.content}\\n\`);`
- Line 214: `const similarFacts = await db.findSimilarLores(factId, {`

**Lines that had "project" references (now updated to "realm"):**
- Line 6: `import { getProjectInfo } from './utils/project.js';`
- Line 31: `.description('LoreHub - Capture and query your project\'s development knowledge')`
- Line 108: `const projectInfo = await getProjectInfo(process.cwd());`
- Line 110-125: Multiple references to `project` variable (should be `realm`)
- Line 168: `projectPath: options.realm,`
- Line 224: `const realm = db.findRealm((similar as any).projectId || similar.realmId);`

### 2. `/src/cli/commands/export.tsx`
**Lines that had "fact" references (now updated to "lore"):**
- Line 100: `for (const fact of projectFacts) {`
- Lines 102-108: Multiple references to `fact` properties

**Lines that had "project" references (now updated to "realm"):**
- Multiple references to `projectFacts` variable (should be `realmLores`)

### 3. `/src/cli/components/LoresView.tsx`
**Lines that had "fact" references (now updated to "lore"):**
- Lines 104-108: `const filtered = facts.filter(fact =>`
- Line 156: Comment `// Add project info to each fact`
- Line 209: `batch.map(async (fact) => {`
- Lines 211, 215, 217: References to `fact.id`
- Line 246: `<Text dimColor>Try adding facts with: lh add "Your fact here"</Text>`
- Lines 263-281: Multiple references to `fact` in mapping function
- Line 333: `message={\`Delete fact: "${selectedFact.content.substring(0, 50)}...\`}`
- Line 364: `? \`Found ${filteredFacts.length} fact${filteredFacts.length !== 1 ? 's' : ''} matching...\``

**Lines that had "project" references (now updated to "realm"):**
- Line 156: Comment about project info
- Line 268: Comment about project marker
- Line 270: `const projectMarker = fact.isCurrentProject ? '•' : ' ';`
- Line 274: Comment mentioning project marker
- Line 426: `text={\`Project: ${selectedFact.projectName}...\`}`

### 4. `/src/cli/utils/project.ts`
This entire file was renamed and refactored:
- Filename: Renamed to `realm.ts`
- Interface `ProjectInfo` → `RealmInfo`
- Function `getProjectInfo` → `getRealmInfo`
- Function `detectProjectName` → `detectRealmName`
- Parameter `projectPath` → `realmPath`
- Comments and variable names throughout

**Lines that had "service" references (now updated to "province"):**
- Lines 77, 85, 93: Function calls to `detectWorkspaceServices`, `detectLernaServices`, `detectNxServices`
- Line 115: Function `detectWorkspaceServices` (should be `detectWorkspaceProvinces`)
- Line 117: Variable `services` (should be `provinces`)
- Line 141: Function `detectLernaServices` (should be `detectLernaProvinces`)
- Line 153: Function `detectNxServices` (should be `detectNxProvinces`)
- Line 155: Variable `services` (should be `provinces`)

### 5. `/src/db/database.ts`
**Comments only:**
- Line 201: `// Realm methods (was Project)`
- Line 251: `// Lore methods (was Fact)`

### 6. `/src/core/types.ts`
**Comments only:**
- Line 36: `realmId: z.string(),  // was projectId`

## Patterns to Replace

### Variable Names
- `facts` → `lores`
- `fact` → `lore`
- `factId` → `loreId`
- `factsByType` → `loresByType`
- `similarFacts` → `similarLores`
- `projectFacts` → `realmLores`
- `project` → `realm`
- `projectInfo` → `realmInfo`
- `projectPath` → `realmPath`
- `projectName` → `realmName`
- `projectMarker` → `realmMarker`
- `isCurrentProject` → `isCurrentRealm`
- `services` → `provinces`

### Function Names
- `getProjectInfo()` → `getRealmInfo()`
- `detectProjectName()` → `detectRealmName()`
- `detectWorkspaceServices()` → `detectWorkspaceProvinces()`
- `detectLernaServices()` → `detectLernaProvinces()`
- `detectNxServices()` → `detectNxProvinces()`

### File Names
- `/src/cli/utils/project.ts` → `/src/cli/utils/realm.ts`

### User-Facing Strings
- "Fact with ID" → "Lore with ID"
- "Try adding facts with" → "Try adding lores with"
- "Delete fact:" → "Delete lore:"
- "Found X fact" → "Found X lore"
- "Project:" → "Realm:"
- "your project's development knowledge" → "your realm's development knowledge"

## Documentation Files
Many documentation files contain old terminology but these are less critical as they document the migration itself. Focus should be on cleaning up the source code first.

## Recommended Approach
1. Start with renaming the file `/src/cli/utils/project.ts` to `realm.ts`
2. Update all imports of this file
3. Update function and interface names in the renamed file
4. Update variable names throughout the codebase
5. Update user-facing strings last to ensure functionality is preserved

## Update Summary
- "fact" → "lore" references updated: ~40 occurrences
- "project" → "realm" references updated: ~50 occurrences  
- "service" → "province" references updated: ~10 occurrences

## Status
✅ COMPLETED - All terminology has been successfully updated in v0.2.1. The codebase now uses the new thematic terminology throughout.

## Summary of Changes
- ✅ All "fact" → "lore" references updated (~40 occurrences)
- ✅ All "project" → "realm" references updated (~50 occurrences)  
- ✅ All "service" → "province" references updated (~10 occurrences)
- ✅ File renamed: `/src/cli/utils/project.ts` → `/src/cli/utils/realm.ts`
- ✅ Commands updated: `search` and `list` unified into `browse`
- ✅ All legacy code removed, no backward compatibility aliases remain