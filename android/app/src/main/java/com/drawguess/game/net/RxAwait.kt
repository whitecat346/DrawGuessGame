package com.drawguess.game.net

import io.reactivex.rxjava3.core.Completable
import io.reactivex.rxjava3.core.Single
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

suspend fun <T : Any> Single<T>.await(): T = suspendCancellableCoroutine { cont ->
    val disposable = subscribe(
        { cont.resume(it) },
        { cont.resumeWithException(it) }
    )
    cont.invokeOnCancellation { disposable.dispose() }
}

suspend fun Completable.await(): Unit = suspendCancellableCoroutine { cont ->
    val disposable = subscribe(
        { cont.resume(Unit) },
        { cont.resumeWithException(it) }
    )
    cont.invokeOnCancellation { disposable.dispose() }
}
