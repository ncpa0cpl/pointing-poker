import * as Sentry from "@sentry/browser";

export class SentryService {
  private static client = Sentry.init({
    dsn:
      "https://4ec29488d3ce352195f0e2d3df9184d1@o4508160774569984.ingest.de.sentry.io/4508160778240080",
    release: RLS_VERSION,
    environment: ENVIRONMENT,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 1.0,
    tracePropagationTargets: [location.origin],
  });

  public static fatal(exception: any) {
    this.client?.captureException(exception, {
      data: {
        level: "fatal",
      },
    });
  }

  public static error(exception: any, data: Record<string, any> = {}) {
    this.client?.captureException(exception, {
      data: {
        ...data,
        level: "error",
      },
    });
  }
}
