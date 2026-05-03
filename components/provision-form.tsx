"use client";

import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

export function ProvisionForm() {
  const [taskDescription, setTaskDescription] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Placeholder for API integration
    console.log("Provisioning new worker with task:", taskDescription);
    
    // TODO: Connect to API
    // await fetch('/api/workers', {
    //   method: 'POST',
    //   body: JSON.stringify({ task: taskDescription }),
    // });
    
    // Reset form after submission
    setTaskDescription("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">
          Provision New Worker
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Describe the task for the new worker agent..."
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            className="min-h-[120px] resize-none bg-secondary/50"
          />
          <Button
            type="submit"
            className="w-full gap-2"
            disabled={!taskDescription.trim()}
          >
            <Plus className="h-4 w-4" />
            Provision Worker
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
