export interface TeeTime {
  golfCourseId: number;
  golfCourseName: string;
  teeTimeId: number;
  teeTimeTitle: string | null;
  dateScheduled: string;
  teeFeeId: number;
  teeFeeTitle: string;
  priceBeforeTax: number;
  minPlayers: number;
  maxPlayers: number;
  bookedPlayers: number;
}

export interface FetchResult {
  fetchedAt: string;
  saturday: string;
  sunday: string;
  teeTimes: TeeTime[];
}
