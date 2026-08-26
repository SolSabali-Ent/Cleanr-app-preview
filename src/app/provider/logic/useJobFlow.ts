export const useJobFlow = (status: string) => {
  const canAdvance = ['en_route', 'arrived', 'in_progress'].includes(status);
  const isComplete = status === 'completed';

  return { canAdvance, isComplete };
};

