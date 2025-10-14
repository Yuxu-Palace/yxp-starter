declare module 'cli-progress-footer' {
  interface CliProgressFooterOptions {
    overrideStdout?: boolean;
    redirectStderr?: boolean;
    discardStdin?: boolean;
    throbber?: string | false;
  }

  interface CliProgressFooter {
    updateProgress(content: string): void;
  }

  function cliProgressFooter(options?: CliProgressFooterOptions): CliProgressFooter;

  export = cliProgressFooter;
}
