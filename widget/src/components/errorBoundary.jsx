import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('React error caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#c53030' }}>
          <p>Something went wrong rendering this message.</p>
          <pre style={{ fontSize: '12px', marginTop: '8px' }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: '8px', padding: '4px 12px', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
