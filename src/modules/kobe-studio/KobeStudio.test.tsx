import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import KobeStudio from './KobeStudio';
import * as studioApi from '@/services/studioMediaApi';

vi.mock('@/services/studioMediaApi', () => ({
  listStudioMediaProjects: vi.fn(async () => []),
  listStudioMediaJobs: vi.fn(async () => []),
  createStudioMediaProject: vi.fn(async (payload) => ({
    id: 'created-project-1',
    ...payload,
  })),
  createStudioMediaJob: vi.fn(async (payload) => ({
    id: 'created-job-1',
    ...payload,
  })),
}));

function setup() {
  return render(<KobeStudio />);
}

describe('KobeStudio module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the main studio dashboard and all studio sections', async () => {
    const view = setup();

    expect(view.getByText('Kobe Studio')).toBeInTheDocument();
    expect(view.getByText('Media Studios')).toBeInTheDocument();
    expect(view.getByText('Creator Marketplace Studio')).toBeInTheDocument();
    expect(view.getByText('Brand Studio')).toBeInTheDocument();
    expect(view.getByText('Football Analytics Studio')).toBeInTheDocument();

    await waitFor(() => expect(studioApi.listStudioMediaProjects).toHaveBeenCalledTimes(1));
    expect(studioApi.listStudioMediaJobs).toHaveBeenCalledTimes(1);
  });

  it('switches sections and filters visible projects', async () => {
    const view = setup();

    expect(await view.findByText('Hotel Booking Promo')).toBeInTheDocument();

    view.getByText('Creator Marketplace Studio').click();
    expect(await view.findByText('Creator Brand Deal Pack')).toBeInTheDocument();

    view.getByText('Football Analytics Studio').click();
    expect(await view.findByText('Football Highlight Breakdown')).toBeInTheDocument();
  });

  it('changes format, then saves a project and queues a job', async () => {
    const view = setup();

    const textarea = view.container.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    if (textarea) {
      textarea.value = 'Create a Swahili ad for Kobe Studio media services';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    view.getByText('ad video').click();
    view.getByText('Save project + queue job').click();

    await waitFor(() => expect(studioApi.createStudioMediaProject).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(studioApi.createStudioMediaJob).toHaveBeenCalledTimes(1));

    expect(studioApi.createStudioMediaProject).toHaveBeenCalledWith(expect.objectContaining({
      section: 'media-studios',
      format: 'ad-video',
      engine: 'MoneyPrinterTurbo',
    }));
    expect(studioApi.createStudioMediaJob).toHaveBeenCalledWith(expect.objectContaining({
      status: 'queued',
      engine: 'MoneyPrinterTurbo',
    }));
  });

  it('shows engine commands for MoneyPrinterTurbo integration', () => {
    const view = setup();

    expect(view.getByText(/npm run studio:media:clone/)).toBeInTheDocument();
    expect(view.getByText(/npm run studio:media:docker/)).toBeInTheDocument();
    expect(view.getByText(/http:\/\/localhost:8501/)).toBeInTheDocument();
    expect(view.getByText(/http:\/\/localhost:8080\/docs/)).toBeInTheDocument();
  });
});
