import React from 'react';
import { Box, Text } from 'ink';

type Scalar = string | number | boolean | null | undefined;
type ScalarDict = {
  [key: string]: Scalar;
};

interface TableProps<T extends ScalarDict> {
  data: T[];
  columns?: (keyof T)[];
  padding?: number;
}

export function Table<T extends ScalarDict>({ 
  data, 
  columns,
  padding = 1 
}: TableProps<T>) {
  if (data.length === 0) {
    return <Text dimColor>No data</Text>;
  }

  // Get columns from first data item if not provided
  const keys = columns || (Object.keys(data[0] || {}) as (keyof T)[]);
  
  // Calculate column widths
  const widths: Record<keyof T, number> = {} as Record<keyof T, number>;
  
  // Initialize with header widths
  keys.forEach(key => {
    widths[key] = String(key).length;
  });
  
  // Update with data widths
  data.forEach(row => {
    keys.forEach(key => {
      const value = String(row[key] ?? '');
      widths[key] = Math.max(widths[key], value.length);
    });
  });
  
  // Add padding
  const paddingStr = ' '.repeat(padding);
  
  // Render header
  const header = (
    <Box>
      {keys.map((key, index) => (
        <Box key={String(key)} width={widths[key] + padding * 2}>
          <Text bold>
            {index > 0 && paddingStr}
            {String(key).padEnd(widths[key])}
            {paddingStr}
          </Text>
        </Box>
      ))}
    </Box>
  );
  
  // Render separator
  const separator = (
    <Box>
      <Text dimColor>
        {keys.map((key, index) => 
          (index > 0 ? paddingStr : '') + 
          '─'.repeat(widths[key]) + 
          paddingStr
        ).join('')}
      </Text>
    </Box>
  );
  
  // Render rows
  const rows = data.map((row, rowIndex) => {
    const isSelected = row[''] === '→'; // Check if this row is selected
    
    return (
      <Box key={rowIndex}>
        {keys.map((key, colIndex) => (
          <Box key={String(key)} width={widths[key] + padding * 2}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {colIndex > 0 && paddingStr}
              {String(row[key] ?? '').padEnd(widths[key])}
              {paddingStr}
            </Text>
          </Box>
        ))}
      </Box>
    );
  });
  
  return (
    <Box flexDirection="column">
      {header}
      {separator}
      {rows}
    </Box>
  );
}