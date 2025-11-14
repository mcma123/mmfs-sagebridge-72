import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Props = {
  onClose: () => void;
};

export default function CompletionStep({ onClose }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Import Completed</CardTitle>
        <CardDescription>Your import has been committed</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end">
          <Button onClick={onClose}>Return to Banking</Button>
        </div>
      </CardContent>
    </Card>
  );
}
