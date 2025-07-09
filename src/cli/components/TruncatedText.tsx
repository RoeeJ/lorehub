import React from 'react';
import { Text } from 'ink';

interface TruncatedTextProps {
  text: string;
  maxLines: number;
  width: number;
  color?: string;
  dimColor?: boolean;
}

export function TruncatedText({ text, maxLines, width, color, dimColor }: TruncatedTextProps) {
  // Split text into words
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  // Build lines respecting width limit
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length <= width) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is too long, truncate it
        lines.push(word.substring(0, width - 3) + '...');
        currentLine = '';
      }
    }
    
    // Stop if we've reached max lines
    if (lines.length >= maxLines) {
      break;
    }
  }
  
  // Add the last line
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  
  // If we have more text, add ellipsis to last line
  if (words.join(' ').length > lines.join(' ').length) {
    const lastLine = lines[lines.length - 1] || '';
    if (lastLine.length > width - 3) {
      lines[lines.length - 1] = lastLine.substring(0, width - 3) + '...';
    } else {
      lines[lines.length - 1] = lastLine + '...';
    }
  }

  return (
    <>
      {lines.map((line, index) => (
        <Text key={index} color={color} dimColor={dimColor}>
          {line}
        </Text>
      ))}
    </>
  );
}