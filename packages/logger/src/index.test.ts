import { log } from './index';

describe('log', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('emits the agreed { level, event, userId, context, timestamp } shape', () => {
    const entry = log.info('checklist.submitted', {
      userId: 'user-123',
      context: { checklistId: 'chk-456' },
    });

    expect(entry).toEqual({
      level: 'info',
      event: 'checklist.submitted',
      userId: 'user-123',
      context: { checklistId: 'chk-456' },
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(entry));
  });

  it('defaults userId and context to null when omitted', () => {
    const entry = log.info('app.started');

    expect(entry.userId).toBeNull();
    expect(entry.context).toBeNull();
  });
});
