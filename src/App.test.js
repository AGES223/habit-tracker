import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
});

test('renders welcome page with navbar and daily quote', () => {
  render(<App />);
  expect(screen.getByRole('link', { name: /campus rhythm/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
  expect(screen.getByText(/build rituals that survive midterms/i)).toBeInTheDocument();
  expect(screen.getByText(/a fresh line every calendar day/i)).toBeInTheDocument();
});
