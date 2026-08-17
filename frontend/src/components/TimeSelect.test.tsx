import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeSelect from './TimeSelect';

// TimeSelect renders one value as two controls and joins them back on the way
// out. timeOptions.test.ts already pins splitWallClock and joinWallClock as
// functions; what it can't see is whether the component wires them together in
// the right order, or whether `granularity` actually removes the minute field.
// Both need a DOM, and neither needs any context - so this is the cheapest
// component test in the suite.

describe('TimeSelect', () => {
  it('joins the hour and minute halves back into HH:mm', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TimeSelect value="00:00" onChange={onChange} label="Start time" />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Start time hour' }), '08');
    expect(onChange).toHaveBeenLastCalledWith('08:00');
  });

  it('keeps the hour when only the minute changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TimeSelect value="08:00" onChange={onChange} label="Start time" />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Start time minute' }), '30');
    expect(onChange).toHaveBeenLastCalledWith('08:30');
  });

  it('offers no minute field at all when the caller is hour-only', () => {
    render(
      <TimeSelect value="09:00" onChange={vi.fn()} label="Shift start" granularity="hour" />
    );

    // Not "renders it disabled" - a greyed ":00" implies a choice exists
    // somewhere, and for a shift boundary it doesn't.
    expect(screen.getByRole('combobox', { name: 'Shift start hour' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Shift start minute' })).toBeNull();
  });

  it('can never emit an off-the-hour minute when hour-only', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    // 08:30 is a legacy value - a record saved before shift boundaries were
    // restricted to the hour. It still has to RENDER (the hour field shows 08)
    // rather than being silently rewritten on mount...
    render(
      <TimeSelect value="08:30" onChange={onChange} label="Shift start" granularity="hour" />
    );
    expect(screen.getByRole('combobox', { name: 'Shift start hour' })).toHaveValue('08');
    expect(onChange).not.toHaveBeenCalled();

    // ...but touching the control normalises it. Carrying the :30 through
    // would produce 09:30, which the save then rejects with "times must be on
    // the hour" - so the field would be repairing the record into a different
    // invalid state.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Shift start hour' }), '09');
    expect(onChange).toHaveBeenLastCalledWith('09:00');
  });
});
