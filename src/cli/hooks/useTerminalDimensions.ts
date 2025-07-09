import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

export function useTerminalDimensions() {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    columns: stdout.columns || 80,
    rows: stdout.rows || 24
  });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        columns: stdout.columns || 80,
        rows: stdout.rows || 24
      });
    };

    // Listen for resize events
    stdout.on('resize', updateDimensions);
    
    // Initial update
    updateDimensions();

    return () => {
      stdout.off('resize', updateDimensions);
    };
  }, [stdout]);

  return dimensions;
}