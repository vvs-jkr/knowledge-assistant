import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // errors are surfaced in the fallback UI and React DevTools
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">{this.state.error.message}</p>
            <button
              type="button"
              className="mt-4 text-sm underline"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
