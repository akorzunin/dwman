import { FC } from 'react';

const AboutPage: FC = () => {
  return (
    <>
      <div className="text-4xl font-bold">Help Page</div>
      <div className="pt-4">
        <h4 className="font-semibold">How to use</h4>
        <ul>
          <li>
            <span>&#8226;</span> Press Save DW button to login with you Spotify
            account
          </li>
          <li>Now site listening you playback</li>
          <li>
            <span>&#8226;</span> If current playlist is not a DW playlist this
            panel will be yellow
          </li>
          <li>
            <span>&#8226;</span> Now if you don't have Spotify Premium (that
            means site can't control user playback) you can quickly play all
            songs in playlist to add them to new playlist
          </li>
          <li>
            <span>&#8226;</span> When playlist start repeating itself a little
            dot will appear to indicate that you didn't lost any tracks
          </li>
          <li>
            <span>&#8226;</span> That's it! Just press Save button and playlist
            will be automatically created
          </li>
        </ul>
      </div>
    </>
  );
};

export default AboutPage;
