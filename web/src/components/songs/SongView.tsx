import { Song } from '../../interfaces/Song';
import { Avatar, AvatarFallback, AvatarImage } from '../../shadcn/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipPositioner,
  TooltipTrigger,
} from '../../shadcn/ui/tooltip';

const SongView: React.FC<{ song: Song }> = ({ song }) => {
  return (
    <>
      <Avatar className="-z-10 h-[64px] w-[64px] rounded-none">
        <AvatarImage src={song.imgUrl} className="h-full" alt="song cover" />
        <AvatarFallback className="rounded-none">NA</AvatarFallback>
      </Avatar>
      <Tooltip>
        <TooltipTrigger
          render={
            <div>
              <p className="line-clamp-1">{song.name}</p>
              <p className="line-clamp-1">
                {song.artists.map((artist) => artist).join(', ')}
              </p>
            </div>
          }
        ></TooltipTrigger>
        <TooltipPositioner>
          <TooltipContent className="text-base">
            <p>{song.name}</p>
            <p className="opacity-80">
              {song.artists.map((artist) => artist).join(', ')}
            </p>
          </TooltipContent>
        </TooltipPositioner>
      </Tooltip>
    </>
  );
};

export default SongView;
