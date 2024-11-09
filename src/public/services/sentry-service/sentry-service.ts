import * as Sentry from "@sentry/browser";

export class SentryService {
  private static client = Sentry.init({
    dsn: SENTRY_DSN,
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
