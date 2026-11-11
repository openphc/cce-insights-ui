import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PagedList } from './PagedList';

const items = Array.from({ length: 12 }, (_, i) => `Item ${i + 1}`);
const shown = () => screen.queryAllByText(/^Item \d+$/).map((el) => el.textContent);

function renderList(list: string[]) {
  return render(<PagedList items={list} pageSize={5} label="Deviations" renderItem={(item) => <p key={item}>{item}</p>} />);
}

describe('PagedList', () => {
  it('shows a page at a time, and moves between pages', () => {
    renderList(items);
    expect(shown()).toEqual(['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5']);
    expect(screen.getByText('1–5 of 12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous deviations' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next deviations' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next deviations' }));

    expect(shown()).toEqual(['Item 11', 'Item 12']);
    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next deviations' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Previous deviations' }));
    expect(screen.getByText('6–10 of 12')).toBeInTheDocument();
  });

  it('leaves the pager out when everything fits on one page', () => {
    renderList(items.slice(0, 5));
    expect(shown()).toHaveLength(5);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows the last page when the list shrinks under the page shown', () => {
    const { rerender } = renderList(items);
    fireEvent.click(screen.getByRole('button', { name: 'Next deviations' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next deviations' }));

    rerender(<PagedList items={items.slice(0, 7)} pageSize={5} label="Deviations" renderItem={(item) => <p key={item}>{item}</p>} />);

    expect(shown()).toEqual(['Item 6', 'Item 7']);
  });
});
