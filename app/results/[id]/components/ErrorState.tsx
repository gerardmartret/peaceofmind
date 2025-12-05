import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  error: string | null;
}

export function ErrorState({ error }: ErrorStateProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold text-card-foreground mb-4">
            Trip Not Found
          </h2>
          <p className="text-muted-foreground mb-6">
            {error || 'This trip analysis could not be found. It may have been deleted or the link is incorrect.'}
          </p>
          <Button
            onClick={() => router.push('/')}
            size="lg"
          >
            Go to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
