export interface Persona {
  name: string;
  role: string;
  avatar: string;
}

export interface Stage {
  id: number;
  name: string;
  status: 'completed' | 'active' | 'upcoming';
  product: {
    name: string;
    logo: string;
    description: string;
  };
  personas: Persona[];
  story: {
    title: string;
    description: string;
    dpdpSection: string;
    impact: string;
  };
  animation?: any;
}

export type StageStatus = 'completed' | 'active' | 'upcoming';

// Made with Bob
