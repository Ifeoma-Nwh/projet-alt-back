import {
  Query,
  Arg,
  Resolver,
  Mutation,
  ID,
  Ctx,
  Authorized,
} from "type-graphql";
import { DeleteResult } from "typeorm";
import { User, UserInput } from "../../Entities/User";
import {
  PointOfInterest,
  PointOfInterestInput,
} from "../../Entities/PointOfInterest";
import dataSource from "../../utils";
import { hash, verify } from "argon2";
import { usersRelations } from "../../utils/relations";
import { sign, verify as jwtVerify } from "jsonwebtoken";
import { authChecker, IContext } from "../auth";

import env from "../../env";

@Resolver()
export class UserResolver {
  ///////// QUERY FIND ALL USERS /////////////
  @Authorized([1])
  @Query(() => [User], { nullable: true })
  async FindAllUsers(): Promise<User[]> {
    return await dataSource.getRepository(User).find({
      relations: usersRelations,
    });
  }

  ///////// QUERY FIND ONE USER /////////////
  @Authorized([1])
  @Query(() => User, { nullable: true })
  async FindUser(@Arg("id", () => ID) id: number): Promise<User | null> {
    const user = await dataSource
      .getRepository(User)
      .findOne({ where: { id }, relations: usersRelations });
    return user;
  }
  ///////// MUTATION CREATE USER /////////////
  @Mutation(() => User)
  async createUser(@Arg("data") data: UserInput): Promise<User> {
    data.password = await hash(data.password);
    if (data.username === "user") {
      data.role = 2;
    }
    return await dataSource.getRepository(User).save(data);
  }

  ///////////// MUTATION SIGNIN //////////////
  @Mutation(() => String, { nullable: true })
  async signin(
    @Arg("email") email: string,
    @Arg("password") password: string
  ): Promise<string | null> {
    try {
      const user = await dataSource
        .getRepository(User)
        .findOne({ where: { email } });
      if (!user) {
        return null;
      }
      if (await verify(user.password, password)) {
        const token = sign(
          { userId: user.id, userRole: user.role },
          process.env.JWT_SECRET_KEY || "supersecret",
          {
            expiresIn: "2h",
          }
        );
        return token;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }

  ///////// QUERY FIND USER CONNECTED /////////////
  @Authorized()
  @Query(() => User, { nullable: true })
  async GetMe(@Ctx() context: IContext): Promise<User | null> {
    return context.user;
  }

  ///////// MUTATION DELETE USER /////////////
  @Authorized([1])
  @Mutation(() => User, { nullable: true })
  async deleteUser(
    @Arg("id", () => ID) id: number
  ): Promise<DeleteResult | null> {
    return await dataSource
      .getRepository(User)
      .createQueryBuilder("users")
      .delete()
      .from(User)
      .where("id = :id", { id })
      .execute();
  }
  ///////// MUTATION UPDATE USERS/////////////
  @Authorized()
  @Mutation(() => User, { nullable: true })
  async updateUser(
    @Arg("id", () => ID) id: number,
    // @Arg("role") role: number,
    // @Arg("updatedByiD") updatedById: number,
    @Arg("data") data: UserInput
  ): Promise<User | null> {
    const updateUser = await dataSource
      .getRepository(User)
      .findOne({ where: { id } });
    if (updateUser === null) {
      return null;
    }
    if (data.role !== null || data.email !== null || data.username !== null) {
      updateUser.role = data.role;
      updateUser.email = data.email;
      updateUser.username = data.username;
    }
    updateUser.updatedById = data.updatedById;
    return await dataSource.getRepository(User).save(updateUser);
  }
  ///////// MUTATION DELETE USERS/////////////
  @Authorized([1])
  @Mutation(() => User)
  async deleteUsers(): Promise<DeleteResult | null> {
    return await dataSource
      .getRepository(User)
      .createQueryBuilder("users")
      .delete()
      .from(User)
      .execute();
  }

  ////// QUERY FIND ALL POIs IN FAVORITES ////////
  @Authorized()
  @Query(() => [PointOfInterest], { nullable: true })
  async findAllFavorites(
    @Arg("userId", () => ID) userId: number
  ): Promise<PointOfInterest[] | null> {
    const user = await dataSource
      .getRepository(User)
      .findOne({ where: { id: userId }, relations: ["favorites"] });

    if (user != null) {
      return user.favorites;
    } else {
      return null;
    }
    /* return await dataSource
      .getRepository(PointOfInterest)
      .find({ where: { users: { id: userId } } }); */
  }

  ////// ADD A POI IN FAVORITES ////////
  @Authorized()
  @Mutation(() => User)
  async addFavorite(
    @Arg("userId", () => ID) userId: number,
    @Arg("pointOfInterestId", () => ID) pointOfInterestId: number
  ): Promise<User | null> {
    const user = await dataSource
      .getRepository(User)
      .findOne({ where: { id: userId }, relations: ["favorites"] });
    const pointOfInterest = await dataSource
      .getRepository(PointOfInterest)
      .findOne({ where: { id: pointOfInterestId } });

    if (!user || !pointOfInterest) {
      throw new Error("User or PointsOfInterest not found");
    }

    user.favorites.push(pointOfInterest);

    return await dataSource.getRepository(User).save(user);
  }

  /////// DELETE A POI IN FAVORITE /////////
  @Authorized()
  @Mutation(() => User)
  async removeFavorite(
    @Arg("userId", () => ID) userId: number,
    @Arg("pointOfInterestId", () => ID) pointOfInterestId: number
  ): Promise<User | null> {
    pointOfInterestId = Number(pointOfInterestId);
    const user = await dataSource
      .getRepository(User)
      .findOne({ where: { id: userId }, relations: ["favorites"] });

    if (!user) {
      return null;
    }

    user.favorites = user.favorites.filter((favorite) => {
      return favorite.id !== pointOfInterestId;
    });

    return await dataSource.getRepository(User).save(user);
  }
}
