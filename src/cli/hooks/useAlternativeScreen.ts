import { useEffect } from 'react';
import { useStdout } from 'ink';

/**
 * Hook to enable alternative screen mode in terminal
 * This allows us to have a full-screen UI that doesn't affect terminal history
 */
export function useAlternativeScreen() {
  const { stdout } = useStdout();

  useEffect(() => {
    // Enter alternative screen mode
    stdout.write('\x1b[?1049h');
    // Hide cursor
    stdout.write('\x1b[?25l');
    // Clear screen
    stdout.write('\x1b[2J');
    // Move cursor to top
    stdout.write('\x1b[H');

    return () => {
      // Show cursor
      stdout.write('\x1b[?25h');
      // Exit alternative screen mode
      stdout.write('\x1b[?1049l');
    };
  }, [stdout]);
}

// Alternative screen escape sequences:
// \x1b[?1049h - Enter alternative screen
// \x1b[?1049l - Exit alternative screen
// \x1b[?25l - Hide cursor
// \x1b[?25h - Show cursor
// \x1b[2J - Clear screen
// \x1b[H - Move cursor to home position