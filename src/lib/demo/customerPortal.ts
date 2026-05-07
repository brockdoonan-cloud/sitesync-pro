export type DemoCustomerBin = {
  id: string
  bin_number: string
  status: 'deployed' | 'needs_swap' | 'full'
  type: string
  location: string
  last_serviced_at: string
  jobsite: {
    id: string
    name: string
    address: string
    city: string
    state: string
    zip: string
  }
}

export const DEMO_CUSTOMER_BINS: DemoCustomerBin[] = [
  {
    id: 'demo-bin-121872',
    bin_number: '121872',
    status: 'needs_swap',
    type: 'Concrete Washout Bin',
    location: 'Tumbleweed - Winter Garden',
    last_serviced_at: '2026-05-04T14:30:00.000Z',
    jobsite: {
      id: 'demo-jobsite-tumbleweed',
      name: 'Tumbleweed',
      address: '5015 Caribbean Way',
      city: 'Winter Garden',
      state: 'FL',
      zip: '32830',
    },
  },
  {
    id: 'demo-bin-131074',
    bin_number: '131074',
    status: 'deployed',
    type: 'Concrete Washout Bin',
    location: 'Project Neptune - Orlando',
    last_serviced_at: '2026-05-05T12:15:00.000Z',
    jobsite: {
      id: 'demo-jobsite-neptune',
      name: 'Project Neptune',
      address: '14200 Lake Nona Blvd',
      city: 'Orlando',
      state: 'FL',
      zip: '32827',
    },
  },
  {
    id: 'demo-bin-165905',
    bin_number: '165905',
    status: 'full',
    type: 'Concrete Washout Bin',
    location: 'Health First Merritt Island Hospital',
    last_serviced_at: '2026-05-03T09:45:00.000Z',
    jobsite: {
      id: 'demo-jobsite-health-first',
      name: 'Health First Merritt Island Hospital',
      address: '255 Borman Dr',
      city: 'Merritt Island',
      state: 'FL',
      zip: '32953',
    },
  },
  {
    id: 'demo-bin-876907',
    bin_number: '876907',
    status: 'deployed',
    type: 'Concrete Washout Bin',
    location: 'Walmart 7039 - Kissimmee',
    last_serviced_at: '2026-05-06T10:00:00.000Z',
    jobsite: {
      id: 'demo-jobsite-walmart-7039',
      name: 'Walmart 7039',
      address: '3250 Vineland Rd',
      city: 'Kissimmee',
      state: 'FL',
      zip: '34746',
    },
  },
]

export function demoJobsiteAddress(bin: DemoCustomerBin) {
  return [bin.jobsite.address, bin.jobsite.city, bin.jobsite.state, bin.jobsite.zip].filter(Boolean).join(', ')
}
