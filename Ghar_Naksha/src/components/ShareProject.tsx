import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import type { Project } from '../types';
import { createShareLink } from '../lib/share';
import './ShareProject.css';

export default function ShareProject({ project }: { project: Project }) {
  const [website, setWebsite] = useState(
    () => `${location.origin}${location.pathname}`,
  );
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let current = true;
    setLink('');
    setError('');
    setCopied(false);
    createShareLink(project, website)
      .then((result) => {
        if (current) setLink(result);
      })
      .catch((cause) => {
        if (current)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Check the website address.',
          );
      });
    return () => {
      current = false;
    };
  }, [project, website]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError(
        'Select the link below and copy it with your browser’s Copy command.',
      );
    }
  };
  let local = false;
  try {
    local = ['localhost', '127.0.0.1', '[::1]'].includes(
      new URL(website).hostname,
    );
  } catch {
    /* URL feedback is shown above. */
  }
  return (
    <div className="share-project">
      <p>
        The link contains a fixed snapshot of every floor, element, stair, and
        connection. Recipients can open it without an account and edit their own
        copy.
      </p>
      <div className="share-snapshot">
        <Link2 size={23} />
        <div>
          <strong>{project.name}</strong>
          <span>
            {project.levels?.length ?? 1} floors · {project.elements.length}{' '}
            elements · No sign-in needed
          </span>
        </div>
      </div>
      <label>
        Website address
        <input
          aria-label="Website address for sharing"
          type="url"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </label>
      {local && (
        <p className="share-local-note">
          This app is running locally. For people outside your network, use the
          public address of a hosted copy of this website.
        </p>
      )}
      <label>
        Snapshot link
        <textarea
          aria-label="Project snapshot link"
          value={link}
          readOnly
          rows={3}
          onFocus={(event) => event.currentTarget.select()}
          placeholder="Preparing snapshot…"
        />
      </label>
      {error && (
        <p className="share-error" role="alert">
          {error}
        </p>
      )}
      <div className="share-actions">
        <button
          className="button button-primary"
          disabled={!link}
          onClick={() => void copy()}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}{' '}
          {copied ? 'Link copied' : 'Copy snapshot link'}
        </button>
        <a
          className="button button-outline"
          href={link || undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!link}
        >
          <ExternalLink size={15} />
          Open snapshot
        </a>
      </div>
      <p className="share-note">
        Later edits do not change this link. Create a new snapshot when you want
        to share an updated design. The full design is in the link, so only
        share it with people you want to give a copy.
      </p>
    </div>
  );
}
