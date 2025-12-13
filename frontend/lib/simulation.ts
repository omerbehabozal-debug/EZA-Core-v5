/**
 * Growth Simulation Layer
 * Simulates growth metrics when real data is insufficient (< 30 samples)
 */

interface UsageData {
  date: string;
  request_count: number;
  risk_avg: number;
  fail_rate: number;
  token_usage: number;
  latency_avg: number;
}

interface SimulatedData extends UsageData {
  simulated: boolean;
}

/**
 * Calculate growth factor based on days active
 */
function calculateGrowthFactor(daysActive: number): number {
  return Math.log(daysActive + 10) / Math.log(10); // Normalized log growth
}

/**
 * Simulate growth for usage data
 * If real data < 30 samples, apply growth simulation
 */
export function simulateGrowth(
  realData: UsageData[],
  daysActive: number = 0
): SimulatedData[] {
  const sampleCount = realData.length;
  
  // If we have 30+ samples, minimal simulation (10% growth)
  if (sampleCount >= 30) {
    const growthFactor = 1.1; // 10% growth
    return realData.map((data) => ({
      ...data,
      request_count: Math.round(data.request_count * growthFactor),
      simulated: true,
    }));
  }
  
  // If < 30 samples, apply full growth simulation
  const growthFactor = 1 + (calculateGrowthFactor(daysActive) * 0.25);
  
  return realData.map((data, index) => {
    // Apply progressive growth (later dates have more growth)
    const progressiveFactor = growthFactor + (index * 0.02);
    
    return {
      ...data,
      request_count: Math.round(data.request_count * progressiveFactor),
      risk_avg: Math.min(100, data.risk_avg * (1 + (progressiveFactor - 1) * 0.1)),
      fail_rate: Math.max(0, data.fail_rate * (1 - (progressiveFactor - 1) * 0.1)),
      token_usage: Math.round(data.token_usage * progressiveFactor),
      latency_avg: data.latency_avg * (1 + (progressiveFactor - 1) * 0.05),
      simulated: true,
    };
  });
}

/**
 * Merge real and simulated data
 * Real data takes precedence, simulated fills gaps
 */
export function mergeRealAndSimulated(
  realData: UsageData[],
  simulatedData: SimulatedData[]
): SimulatedData[] {
  const merged: Map<string, SimulatedData> = new Map();
  
  // Add real data first
  realData.forEach((data) => {
    merged.set(data.date, {
      ...data,
      simulated: false,
    });
  });
  
  // Fill gaps with simulated data
  simulatedData.forEach((data) => {
    if (!merged.has(data.date)) {
      merged.set(data.date, data);
    }
  });
  
  // Sort by date
  return Array.from(merged.values()).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/**
 * Calculate days active from data
 */
export function calculateDaysActive(data: UsageData[]): number {
  if (data.length === 0) return 0;
  
  const dates = data.map(d => new Date(d.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const diffTime = maxDate - minDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(1, diffDays);
}

