export const API_BASE_URL = __DEV__
  ? 'http://31.97.239.1:4343/api'
  : 'http://31.97.239.1:4343/api';

export type SyncEventRequest = {
  eventId: string;
  employeeId: string;
  eventType: string;
  payload: any;
  createdAt: string;
};

export async function syncEventToBackend(event: SyncEventRequest): Promise<{ success: boolean; alreadyProcessed?: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/attendance/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, alreadyProcessed: data.alreadyProcessed || false };
  } catch (error) {
    console.error('Failed to sync event:', error);
    throw error;
  }
}