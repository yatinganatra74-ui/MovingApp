import { supabase } from './supabase';

export async function generateJobNumber(): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('generate_job_number');

    if (error) {
      console.error('Error generating job number:', error);
      const fallback = `JOB${Date.now()}`;
      return fallback;
    }

    return data as string;
  } catch (error) {
    console.error('Failed to generate job number:', error);
    return `JOB${Date.now()}`;
  }
}

export async function getJobStatusHistory(jobId: string) {
  const { data, error } = await supabase
    .from('job_status_history')
    .select('*')
    .eq('job_id', jobId)
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('Error fetching job status history:', error);
    return [];
  }

  return data || [];
}

export async function updateJobStatus(
  jobId: string,
  newStatus: string,
  notes?: string
): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ status: newStatus })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update job status: ${error.message}`);
  }

  if (notes) {
    await supabase
      .from('job_status_history')
      .update({ notes })
      .eq('job_id', jobId)
      .order('changed_at', { ascending: false })
      .limit(1);
  }
}
