import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
});

test('renders welcome page with navbar and daily quote', () => {
  render(<App />);
  expect(screen.getByRole('link', { name: /campus rhythm/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  expect(screen.getByText(/build better habits, one day at a time/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /get started free/i })).toBeInTheDocument();
  expect(screen.getByText(/a fresh line every calendar day/i)).toBeInTheDocument();
});
